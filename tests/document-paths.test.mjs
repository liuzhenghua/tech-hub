import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDirectory, isDocumentPath } from '../src/document-paths.js';
import { parseRoute, documentHash } from '../src/routes.js';
test('root configuration includes top-level and nested Markdown and supports routes', () => {
  const root = normalizeDirectory('/');
  assert.equal(root, '');
  for (const path of ['README.md', 'docs/a.md', 'tools/readme.MD']) {
    assert.ok(isDocumentPath(path, root));
    assert.equal(parseRoute(documentHash(path), root).path, path);
  }
  for (const path of [
    '/README.md',
    '../secret.md',
    'a/../b.md',
    'a//b.md',
    'index.html',
  ])
    assert.equal(isDocumentPath(path, root), false);
});
test('subdirectory configurations retain their boundary', () => {
  assert.equal(normalizeDirectory('/knowledge/docs/'), 'knowledge/docs');
  assert.ok(isDocumentPath('knowledge/docs/a.md', 'knowledge/docs'));
  assert.equal(isDocumentPath('other/a.md', 'knowledge/docs'), false);
  for (const value of ['', '../docs', 'a//b'])
    assert.throws(() => normalizeDirectory(value));
});
