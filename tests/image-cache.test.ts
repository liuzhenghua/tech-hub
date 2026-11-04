import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ImageCache } from '../src/documents/image-cache';
const value = (content = 'AAAA') => ({
  path: 'image.png',
  encoding: 'base64',
  content,
});
test('cached images and concurrent reads reuse one request', async () => {
  const cache = new ImageCache();
  let calls = 0;
  const read = async () => {
    calls++;
    return value();
  };
  const [a, b] = await Promise.all([
    cache.get('ref/path', read),
    cache.get('ref/path', read),
  ]);
  assert.equal(a, b);
  await cache.get('ref/path', read);
  assert.equal(calls, 1);
  await cache.get('new-ref/path', read);
  assert.equal(calls, 2);
});
test('LRU evicts least recently used images and oversized images are not retained', async () => {
  const cache = new ImageCache(16);
  const calls: string[] = [];
  const get = (key: string, content = 'AAAA') =>
    cache.get(key, async () => {
      calls.push(key);
      return value(content);
    });
  await get('a');
  await get('b');
  await get('a');
  await get('c');
  await get('a');
  await get('b');
  assert.deepEqual(calls, ['a', 'b', 'c', 'b']);
  await get('huge', 'A'.repeat(20));
  await get('huge', 'A'.repeat(20));
  assert.equal(calls.filter((key) => key === 'huge').length, 2);
});
test('failed requests can retry, clear removes values and invalidates pending results', async () => {
  const cache = new ImageCache();
  await assert.rejects(
    cache.get('fail', async () => {
      throw Error('network');
    }),
  );
  await cache.get('fail', async () => value());
  let finish!: (image: ReturnType<typeof value>) => void;
  const pending = cache.get(
    'pending',
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await Promise.resolve();
  cache.clear();
  finish(value());
  await assert.rejects(pending, { name: 'AbortError' });
  let calls = 0;
  await cache.get('fail', async () => {
    calls++;
    return value();
  });
  assert.equal(calls, 1);
});
