import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseControl,
  safeName,
  MAX_FILE_SIZE,
} from '../src/tools/lan-transfer/protocol.ts';
import {
  Transfer,
  type TransferView,
} from '../src/tools/lan-transfer/transfer.ts';

class Channel extends EventTarget {
  readyState = 'open';
  bufferedAmount = 0;
  sent: (string | ArrayBuffer)[] = [];
  send(value: string | ArrayBuffer) {
    this.sent.push(value);
  }
  close() {
    this.readyState = 'closed';
  }
  receive(data: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
}
function fixture() {
  const channel = new Channel();
  const controller = new AbortController();
  const statuses: string[] = [];
  const files: { name: string; blob: Blob }[] = [];
  let busy = false;
  const view: TransferView = {
    status: (value) => statuses.push(value),
    progress: () => {},
    request: () => {},
    busy: (value) => {
      busy = value;
    },
    received: (name, blob) => files.push({ name, blob }),
  };
  const transfer = new Transfer(
    channel as unknown as RTCDataChannel,
    controller.signal,
    view,
  );
  const control = (value: object) => channel.receive(JSON.stringify(value));
  return {
    channel,
    controller,
    statuses,
    files,
    transfer,
    control,
    isBusy: () => busy,
  };
}
test('metadata rejects invalid types, oversized files and excessive input', () => {
  assert.throws(() => parseControl('x'.repeat(4097)));
  assert.equal(MAX_FILE_SIZE, 256_000_000);
  for (const size of [128 * 1024 * 1024 + 1, MAX_FILE_SIZE])
    assert.deepEqual(
      parseControl(JSON.stringify({ type: 'file', name: 'large.bin', size })),
      { type: 'file', name: 'large.bin', size },
    );
  for (const size of [-1, 1.5, MAX_FILE_SIZE + 1])
    assert.throws(() =>
      parseControl(JSON.stringify({ type: 'file', name: 'a', size })),
    );
  assert.throws(() => parseControl('{"type":"file","name":"","size":0}'));
  assert.throws(() => parseControl('{"type":"unknown"}'));
  assert.equal(safeName('../a\\b\0'), '.._a_b_');
});
test('receive requires consent, assembles exact bytes, and acknowledges completion', async () => {
  const f = fixture();
  try {
    f.control({ type: 'file', name: '你好.txt', size: 3 });
    assert.equal(f.isBusy(), true);
    f.transfer.respond(true);
    f.channel.receive(new Uint8Array([1, 2, 3]).buffer);
    f.control({ type: 'end' });
    assert.deepEqual(
      new Uint8Array(await f.files[0].blob.arrayBuffer()),
      new Uint8Array([1, 2, 3]),
    );
    assert.equal(f.files[0].name, '你好.txt');
    assert.equal(f.channel.sent.at(-1), '{"type":"received"}');
    assert.equal(f.isBusy(), false);
  } finally {
    f.controller.abort();
  }
});
test('unsolicited, truncated and oversized binary data never produce a file', () => {
  for (const mode of ['unsolicited', 'truncated', 'oversized']) {
    const f = fixture();
    try {
      f.control({ type: 'file', name: 'a', size: 1 });
      if (mode !== 'unsolicited') f.transfer.respond(true);
      if (mode !== 'truncated')
        f.channel.receive(new Uint8Array([1, 2]).buffer);
      else f.control({ type: 'end' });
      assert.equal(f.files.length, 0);
      assert.equal(f.channel.readyState, 'closed');
      assert.equal(f.isBusy(), false);
    } finally {
      f.controller.abort();
    }
  }
});
test('reject and abort release pending transfers; empty files are supported', () => {
  const f = fixture();
  try {
    f.control({ type: 'file', name: 'a', size: 0 });
    f.transfer.respond(false);
    assert.equal(f.isBusy(), false);
    f.control({ type: 'file', name: 'empty', size: 0 });
    f.transfer.respond(true);
    f.control({ type: 'end' });
    assert.equal(f.files[0].blob.size, 0);
    f.control({ type: 'file', name: 'pending', size: 10 });
    f.controller.abort();
    assert.equal(f.isBusy(), false);
  } finally {
    f.controller.abort();
  }
});
test('sender waits for acceptance, handles collision and rejection without reading a file', () => {
  const f = fixture();
  try {
    const file = new File(['data'], 'a.txt');
    f.transfer.send(file);
    assert.equal(f.channel.sent.length, 1);
    assert.throws(() => f.transfer.send(file));
    f.control({ type: 'file', name: 'collision', size: 0 });
    assert.equal(f.channel.sent.at(-1), '{"type":"reject"}');
    f.control({ type: 'reject' });
    assert.equal(f.isBusy(), false);
  } finally {
    f.controller.abort();
  }
});

test('pairing codes accept hand-entered formatting and reject invalid input', async () => {
  const { pairingCode, generateCode, peerError } =
    await import('../src/tools/lan-transfer/pairing.ts');
  assert.equal(pairingCode('234-567'), '234567');
  assert.equal(pairingCode(' 234 567 '), '234567');
  for (const pin of ['123', 'OOOO0000', 'ABCD2345/', '1234567'])
    assert.throws(() => pairingCode(pin));
  assert.match(generateCode(), /^[1-9][0-9]{5}$/);
  assert.match(peerError({ type: 'peer-unavailable' }), /找不到/);
  assert.match(peerError({ type: 'network' }), /PeerJS Cloud/);
});

test('sending is chunked and stays busy until the receiver confirms completion', async () => {
  const { waitUntil } = await import('../src/tools/lan-transfer/wait.ts');
  const f = fixture();
  try {
    const bytes = new Uint8Array(40_000).map((_, index) => index % 251);
    f.transfer.send(new File([bytes], 'large.bin'));
    f.control({ type: 'accept' });
    await waitUntil(
      () => f.channel.sent.at(-1) === '{"type":"end"}',
      f.controller.signal,
      2000,
    );
    const chunks = f.channel.sent.filter(
      (value) => value instanceof ArrayBuffer,
    );
    assert.equal(chunks.length, 3);
    assert.deepEqual(
      new Uint8Array(await new Blob(chunks).arrayBuffer()),
      bytes,
    );
    assert.equal(f.isBusy(), true);
    assert.match(f.statuses.at(-1)!, /等待对方确认/);
    f.control({ type: 'received' });
    assert.equal(f.isBusy(), false);
    assert.match(f.statuses.at(-1)!, /完整接收/);
  } finally {
    f.controller.abort();
  }
});
test('aborting a wait rejects even when its condition is already true', async () => {
  const { waitUntil } = await import('../src/tools/lan-transfer/wait.ts');
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    waitUntil(() => true, controller.signal),
    { name: 'AbortError' },
  );
});
