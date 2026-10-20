import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentHash, parseRoute } from '../src/routes.js';
test('document URLs round-trip nested and non-ASCII paths and sections', () => {
  const path = 'docs/agents/中文 帮助.md';
  assert.deepEqual(parseRoute(documentHash(path, '标题 & 示例')), {
    docs: true,
    path,
    anchor: '标题 & 示例',
  });
  assert.equal(parseRoute('#docs').path, '');
  assert.equal(parseRoute('#tools').docs, false);
});
test('routes reject paths outside docs', () => {
  for (const path of ['tools/a.md', 'docs/../secret.md', 'docs/a.js'])
    assert.equal(parseRoute(documentHash(path)).path, '');
});
