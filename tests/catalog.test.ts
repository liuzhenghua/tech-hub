import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryOf, matchesDocument } from '../src/documents/preview';
test('catalog categories respect nested roots and repository-root files', () => {
  assert.equal(
    categoryOf('knowledge/docs/agents/a.md', 'knowledge/docs'),
    'knowledge/docs/agents',
  );
  assert.equal(
    categoryOf('knowledge/docs/README.md', 'knowledge/docs'),
    '@root',
  );
  assert.equal(categoryOf('README.md', ''), '@root');
  assert.equal(categoryOf('tools/a.md', ''), 'tools');
});
test('search includes summary and title while maintaining category boundaries', () => {
  const entry = { path: 'docs/agents/a.md', sha: 'sha' };
  const preview = { title: 'Agent 指南', text: '连接 MCP 服务' };
  assert.ok(matchesDocument(entry, preview, 'mcp', 'docs/agents', 'docs'));
  assert.ok(matchesDocument(entry, preview, 'agent', '', 'docs'));
  assert.equal(
    matchesDocument(entry, preview, 'mcp', 'docs/network', 'docs'),
    false,
  );
  assert.equal(matchesDocument(entry, undefined, 'mcp', '', 'docs'), false);
});
