import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  documentGroups,
  matchingGroupDocuments,
} from '../src/documents/groups';
import type { Preview } from '../src/documents/types';
import { buildDocumentIndex } from '../src/documents/indexer';

const entries = (...paths: string[]) =>
  paths.map((path) => ({ path, sha: path }));
test('unmarked and true remain main documents; false belongs to the nearest unique main regardless of filename', () => {
  const documents = entries(
    'docs/topic/任意名称.md',
    'docs/topic/child.md',
    'docs/topic/deep/child.md',
    'docs/other/main.md',
    'docs/other/extra.md',
  );
  const metadata: Record<string, Preview> = {
    'docs/topic/child.md': { standalone: false, text: '' },
    'docs/topic/deep/child.md': { standalone: false, text: '' },
    'docs/other/extra.md': { standalone: true, text: '' },
  };
  const groups = documentGroups(documents, (path) => metadata[path]);
  assert.deepEqual(
    groups.map((group) => [
      group.entry.path,
      group.children.map((child) => child.path),
    ]),
    [
      [
        'docs/topic/任意名称.md',
        ['docs/topic/child.md', 'docs/topic/deep/child.md'],
      ],
      ['docs/other/main.md', []],
      ['docs/other/extra.md', []],
    ],
  );
});

test('a nested main owns its children; ambiguous or absent owners do not guess', () => {
  const documents = entries(
    'docs/main.md',
    'docs/sub/own.md',
    'docs/sub/child.md',
    'docs/multi/a.md',
    'docs/multi/b.md',
    'docs/multi/child.md',
    'orphan.md',
  );
  const preview = (path: string) => ({
    text: '',
    standalone: !path.endsWith('child.md') && path !== 'orphan.md',
  });
  const groups = documentGroups(documents, preview);
  assert.deepEqual(
    groups.find((group) => group.entry.path === 'docs/main.md')?.children,
    [],
  );
  assert.deepEqual(
    groups
      .find((group) => group.entry.path === 'docs/sub/own.md')
      ?.children.map((child) => child.path),
    ['docs/sub/child.md'],
  );
  assert.equal(
    groups.reduce((sum, group) => sum + group.children.length, 0),
    1,
  );
});

test('full-text, title and path matches on children aggregate into one main group', () => {
  const documents = entries(
    'docs/topic/main.md',
    'docs/topic/child.md',
    'docs/topic/deep.md',
  );
  const metadata: Record<string, Preview> = {
    'docs/topic/main.md': { text: '主摘要' },
    'docs/topic/child.md': {
      standalone: false,
      text: '',
      title: '子标题',
      searchText: 'x'.repeat(9000) + 'HiddenNeedle',
    },
    'docs/topic/deep.md': {
      standalone: false,
      text: '',
      searchText: 'HiddenNeedle',
    },
  };
  const groups = documentGroups(documents, (path) => metadata[path]);
  assert.equal(groups.length, 1);
  assert.equal(
    matchingGroupDocuments(groups[0], (path) => metadata[path], 'hiddenneedle')
      .length,
    2,
  );
  assert.equal(
    matchingGroupDocuments(groups[0], (path) => metadata[path], '子标题')
      .length,
    1,
  );
  assert.equal(
    matchingGroupDocuments(groups[0], (path) => metadata[path], 'child.md')
      .length,
    1,
  );
  assert.equal(
    matchingGroupDocuments(groups[0], (path) => metadata[path], '不存在')
      .length,
    0,
  );
});

test('index reads all uncached documents with bounded concurrency and preserves successful results on failure', async () => {
  const documents = entries(
    ...Array.from({ length: 7 }, (_, i) => `docs/${i}.md`),
  );
  const previews = new Map<string, Preview>([
    ['docs/0.md', { text: '', searchText: 'cached' }],
  ]);
  let running = 0,
    maximum = 0;
  const reads: string[] = [];
  const failures = await buildDocumentIndex(
    documents,
    (path) => previews.get(path),
    async (path) => {
      reads.push(path);
      maximum = Math.max(maximum, ++running);
      await new Promise((resolve) => setImmediate(resolve));
      running--;
      if (path === 'docs/3.md') throw Error('offline');
      return path;
    },
    (path, markdown) => previews.set(path, { text: '', searchText: markdown }),
    () => true,
  );
  assert.equal(maximum, 3);
  assert.equal(reads.length, 6);
  assert.deepEqual(failures, ['docs/3.md']);
  assert.equal(previews.size, 6);
});

test('cancelled indexing never records stale asynchronous results', async () => {
  let active = true;
  const recorded: string[] = [];
  await assert.rejects(
    buildDocumentIndex(
      entries('docs/a.md'),
      () => undefined,
      async () => {
        active = false;
        return 'stale';
      },
      (path) => recorded.push(path),
      () => active,
    ),
    { name: 'AbortError' },
  );
  assert.deepEqual(recorded, []);
});
