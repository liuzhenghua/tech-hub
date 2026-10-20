import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentCache } from '../src/cache.js';
const storage = () => {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
};
test('cache restores only matching credential scope and invalidates changed files', () => {
  const store = storage();
  let cache = new DocumentCache(store, 'repo:box');
  cache.index([{ path: 'docs/a.md', sha: 'a' }]);
  cache.put('docs/a.md', 'a', '# A', 'A');
  cache = new DocumentCache(store, 'repo:box');
  assert.equal(cache.get('docs/a.md').title, 'A');
  assert.equal(new DocumentCache(store, 'repo:other').data.entries.length, 0);
  cache.index([{ path: 'docs/a.md', sha: 'b' }]);
  assert.equal(cache.get('docs/a.md'), undefined);
  cache.clear();
  assert.equal(new DocumentCache(store, 'repo:box').data.entries.length, 0);
});
test('cache is bounded and tolerates unavailable storage', () => {
  const cache = new DocumentCache(storage(), 'scope');
  for (let i = 0; i < 12; i++) cache.put('' + i, 'sha', 'text', 'title');
  assert.equal(Object.keys(cache.data.documents).length, 10);
  assert.equal(cache.get('0'), undefined);
  const blocked = new DocumentCache(
    {
      getItem() {
        throw Error();
      },
      setItem() {
        throw Error();
      },
      removeItem() {
        throw Error();
      },
    },
    'scope',
  );
  assert.doesNotThrow(() => {
    blocked.index([]);
    blocked.clear();
  });
});
