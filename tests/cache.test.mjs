import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentCache } from '../src/documents/cache.ts';
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

test('summaries persist independently of bounded body cache and invalidate by SHA', () => {
  const store = storage();
  let cache = new DocumentCache(store, 'scope');
  const entries = Array.from({ length: 12 }, (_, i) => ({
    path: `docs/${i}.md`,
    sha: `sha-${i}`,
  }));
  cache.index(entries);
  for (const item of entries) {
    cache.putPreview(item.path, item.sha, {
      title: item.path,
      text: 'summary',
      standalone: false,
    });
    cache.put(item.path, item.sha, 'body', 'title');
  }
  cache = new DocumentCache(store, 'scope');
  assert.equal(cache.get('docs/0.md'), undefined);
  assert.equal(cache.preview('docs/0.md').text, 'summary');
  assert.equal(cache.preview('docs/0.md').standalone, false);
  cache.index(
    entries.map((x) => (x.path === 'docs/0.md' ? { ...x, sha: 'changed' } : x)),
  );
  assert.equal(cache.preview('docs/0.md'), undefined);
  assert.equal(cache.preview('docs/1.md').text, 'summary');
});

test('legacy previews are rebuilt without discarding cached bodies', () => {
  const store = storage();
  const cache = new DocumentCache(store, 'scope');
  cache.putPreview('docs/a.md', 'sha', { text: 'legacy' });
  cache.put('docs/a.md', 'sha', '# A', 'A');
  const restored = new DocumentCache(store, 'scope');
  assert.equal(restored.preview('docs/a.md'), undefined);
  assert.equal(restored.get('docs/a.md').markdown, '# A');
});
