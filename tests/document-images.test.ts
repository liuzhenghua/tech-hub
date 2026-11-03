import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareDocumentImages } from '../src/documents/images';
import type { DocumentSource } from '../src/documents/types';

class Node extends EventTarget {
  children: Node[] = [];
  attributes = new Map<string, string>();
  hidden = false;
  textContent = '';
  className = '';
  src = '';
  frame?: Node;
  decode: () => Promise<void> = async () => {};
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  append(...children: Node[]) {
    this.children.push(...children);
  }
  replaceWith(frame: Node) {
    this.frame = frame;
  }
}
function fixture(
  t: any,
  file: () => Promise<unknown>,
  decode?: () => Promise<void>,
) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => new Node() },
  });
  t.after(() =>
    previous
      ? Object.defineProperty(globalThis, 'document', previous)
      : Reflect.deleteProperty(globalThis, 'document'),
  );
  const revoked: string[] = [];
  t.mock.method(URL, 'createObjectURL', () => 'blob:test');
  t.mock.method(URL, 'revokeObjectURL', (url: string) => revoked.push(url));
  const img = new Node();
  img.setAttribute('src', '../../assets/image.png');
  if (decode) img.decode = decode;
  const repository = { file } as unknown as DocumentSource;
  const loader = prepareDocumentImages(
    { querySelectorAll: () => [img] } as unknown as ParentNode,
    'docs/topic/main.md',
    () => repository,
    () => true,
  );
  const frame = img.frame!;
  const placeholder = frame.children[0];
  t.after(loader.dispose);
  return {
    img,
    loader,
    frame,
    placeholder,
    label: placeholder.children[0],
    retry: placeholder.children[1],
    revoked,
  };
}
const image = { path: 'assets/image.png', encoding: 'base64', content: 'AAEC' };

test('image stays hidden during fetch and decode, then replaces the loading placeholder', async (t) => {
  let resolveFetch!: (value: unknown) => void;
  let resolveDecode!: () => void;
  const f = fixture(
    t,
    () =>
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    () =>
      new Promise((resolve) => {
        resolveDecode = resolve;
      }),
  );
  const loading = f.loader.load();
  assert.equal(f.img.hidden, true);
  assert.equal(f.label.textContent, '图片加载中…');
  resolveFetch(image);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.img.hidden, true);
  assert.equal(f.placeholder.hidden, false);
  resolveDecode();
  await loading;
  assert.equal(f.img.hidden, false);
  assert.equal(f.placeholder.hidden, true);
  assert.equal(f.frame.getAttribute('aria-busy'), 'false');
});

test('failed images offer retry and recover without exposing a broken image', async (t) => {
  let calls = 0;
  const f = fixture(t, async () => {
    if (++calls === 1) throw Error('network');
    return image;
  });
  await f.loader.load();
  assert.equal(f.img.hidden, true);
  assert.equal(f.label.textContent, '图片加载失败');
  assert.equal(f.retry.hidden, false);
  f.retry.dispatchEvent(new Event('click', { cancelable: true }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
  assert.equal(f.img.hidden, false);
});

test('dispose while decoding releases blob URLs and prevents a stale image becoming visible', async (t) => {
  let decoded!: () => void;
  const f = fixture(
    t,
    async () => image,
    () =>
      new Promise((resolve) => {
        decoded = resolve;
      }),
  );
  const loading = f.loader.load();
  await new Promise((resolve) => setImmediate(resolve));
  f.loader.dispose();
  decoded();
  await loading;
  assert.equal(f.img.hidden, true);
  assert.deepEqual(f.revoked, ['blob:test']);
});
