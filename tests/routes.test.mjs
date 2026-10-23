import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentHash, parseRoute } from '../src/routes.ts';
test('document URLs round-trip nested and non-ASCII paths and sections', () => {
  const path = 'docs/agents/中文 帮助.md';
  assert.deepEqual(parseRoute(documentHash(path, '标题 & 示例')), {
    docs: true,
    path,
    anchor: '标题 & 示例',
  });
  assert.equal(parseRoute('#/docs').path, '');
  assert.equal(parseRoute('#/tools').docs, false);
});
test('routes reject paths outside docs', () => {
  for (const path of ['tools/a.md', 'docs/../secret.md', 'docs/a.js'])
    assert.equal(parseRoute(documentHash(path)).path, '');
});

test('page routing uses the new hash routes without legacy aliases', () => {
  assert.equal(parseRoute('#/docs').docs, true);
  for (const hash of ['', '#/tools', '#tools', '#docs'])
    assert.equal(parseRoute(hash).docs, false);
  assert.match(documentHash('docs/a.md'), /^#\/docs\?/);
});
