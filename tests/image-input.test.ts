import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mountImageInput } from '../src/tools/image-shared/input';
class Node extends EventTarget {
  hidden = false;
  textContent = '';
  value = '';
  files: File[] = [];
  classList = { add() {}, remove() {} };
  contains() {
    return false;
  }
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture(t: TestContext) {
  const doc = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: new Node(),
  });
  const decode = Object.getOwnPropertyDescriptor(
    globalThis,
    'createImageBitmap',
  );
  const pending: ((value: unknown) => void)[] = [];
  Object.defineProperty(globalThis, 'createImageBitmap', {
    configurable: true,
    value: () => new Promise((resolve) => pending.push(resolve)),
  });
  t.after(() => {
    if (doc) Object.defineProperty(globalThis, 'document', doc);
    else Reflect.deleteProperty(globalThis, 'document');
    if (decode) Object.defineProperty(globalThis, 'createImageBitmap', decode);
    else Reflect.deleteProperty(globalThis, 'createImageBitmap');
  });
  const nodes = new Map<string, Node>();
  const root = Object.assign(new Node(), {
    querySelector(id: string) {
      if (!nodes.has(id)) nodes.set(id, new Node());
      return nodes.get(id)!;
    },
  });
  const closed: string[] = [],
    revoked: string[] = [];
  t.mock.method(URL, 'createObjectURL', () => `blob:${revoked.length}`);
  t.mock.method(URL, 'revokeObjectURL', (url) => revoked.push(url));
  const changes: unknown[] = [];
  const input = mountImageInput(root as unknown as HTMLElement, (asset) =>
    changes.push(asset),
  );
  const bitmap = (name: string, width = 100) => ({
    width,
    height: 100,
    close: () => closed.push(name),
  });
  function select(name: string) {
    const node = root.querySelector('#file-input');
    node.files = [new File(['image'], name, { type: 'image/png' })];
    node.dispatchEvent(new Event('change'));
  }
  t.after(input.dispose);
  return { input, pending, bitmap, select, closed, revoked, changes, root };
}
test('replacing an image during decoding ignores and closes the stale bitmap', async (t) => {
  const f = fixture(t);
  f.select('old.png');
  f.select('new.png');
  f.pending[1](f.bitmap('new'));
  await tick();
  f.pending[0](f.bitmap('old'));
  await tick();
  assert.equal(f.input.get()?.file.name, 'new.png');
  assert.deepEqual(f.closed, ['old']);
  assert.equal(f.changes.length, 1);
  f.input.dispose();
  assert.deepEqual(f.closed, ['old', 'new']);
  assert.equal(f.revoked.length, 1);
});
test('clearing while a decode is pending cannot resurrect the image', async (t) => {
  const f = fixture(t);
  f.select('image.png');
  f.root.querySelector('#clear-file').dispatchEvent(new Event('click'));
  f.pending[0](f.bitmap('cleared'));
  await tick();
  assert.equal(f.input.get(), null);
  assert.deepEqual(f.closed, ['cleared']);
  assert.deepEqual(f.changes, [null]);
});
test('excessive decoded dimensions are rejected without replacing the current image', async (t) => {
  const f = fixture(t);
  f.select('good.png');
  f.pending[0](f.bitmap('good'));
  await tick();
  f.select('huge.png');
  f.pending[1](f.bitmap('huge', 9000));
  await tick();
  assert.equal(f.input.get()?.file.name, 'good.png');
  assert.deepEqual(f.closed, ['huge']);
  assert.match(f.root.querySelector('#status').textContent, /图片过大/);
});
