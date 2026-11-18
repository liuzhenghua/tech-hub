import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import type { Peer, DataConnection } from 'peerjs';
import { PairSession } from '../src/tools/lan-transfer/session.ts';
import { ICE_CONFIG, DIRECT_TIMEOUT } from '../src/tools/lan-transfer/ice.ts';

class CloudPeer extends EventEmitter {
  destroyed = false;
  disconnected = false;
  destroy() {
    this.destroyed = true;
  }
  disconnect() {
    this.disconnected = true;
    this.emit('disconnected');
  }
}
class Connection extends EventEmitter {
  open = false;
  sent: string[] = [];
  dataChannel = { send: (value: string) => this.sent.push(value) };
  close() {
    this.emit('close');
  }
}
async function fixture() {
  const peer = new CloudPeer();
  const connection = new Connection();
  let requests = 0,
    ready = 0;
  const errors: string[] = [];
  const session = new PairSession(
    {
      code: () => {},
      request: () => {
        requests++;
      },
      ready: () => {
        ready++;
      },
      status: () => {},
      diagnostic: () => {},
      failed: (value) => errors.push(value),
    },
    () => {
      queueMicrotask(() => peer.emit('open'));
      return peer as unknown as Peer;
    },
  );
  await session.host();
  peer.emit('connection', connection as unknown as DataConnection);
  return {
    session,
    peer,
    connection,
    errors,
    requests: () => requests,
    ready: () => ready,
  };
}
test('host sees a pairing request before ICE/data-channel open; early approval waits for the channel', async () => {
  const f = await fixture();
  try {
    assert.equal(f.requests(), 1);
    assert.equal(f.ready(), 0);
    f.session.respond(true);
    assert.equal(f.ready(), 0);
    assert.deepEqual(f.connection.sent, []);
    f.connection.open = true;
    f.connection.emit('open');
    assert.equal(f.ready(), 1);
    assert.deepEqual(f.connection.sent, ['tech-hub:paired:v1']);
    assert.equal(f.peer.disconnected, true);
    assert.deepEqual(f.errors, []);
  } finally {
    f.session.dispose();
  }
});
test('opening the data channel alone never authorizes transfer', async () => {
  const f = await fixture();
  try {
    f.connection.open = true;
    f.connection.emit('open');
    assert.equal(f.ready(), 0);
    f.session.respond(true);
    assert.equal(f.ready(), 1);
  } finally {
    f.session.dispose();
  }
});
test('host can reject while ICE is still checking; ICE failures identify direct-path/VPN limitations', async () => {
  const f = await fixture();
  try {
    f.session.respond(false);
    assert.match(f.errors[0], /已拒绝/);
    assert.equal(f.ready(), 0);
  } finally {
    f.session.dispose();
  }
  const g = await fixture();
  try {
    // PeerJS reports its negotiation error before the ICE-state event.
    g.connection.emit('error', { type: 'negotiation-failed' });
    assert.equal(g.errors[0], DIRECT_TIMEOUT);
    assert.match(g.errors[0], /VPN/);
    assert.equal(g.ready(), 0);
  } finally {
    g.session.dispose();
  }
});
test('ICE configuration enables address discovery without file relays', () => {
  const urls = ICE_CONFIG.iceServers!.flatMap((server) => [server.urls].flat());
  assert.ok(urls.some((url) => url.startsWith('stun:')));
  assert.ok(
    urls.every((url) => !url.startsWith('turn:') && !url.startsWith('turns:')),
  );
});
