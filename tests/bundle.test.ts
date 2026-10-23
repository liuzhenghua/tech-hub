import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import {
  bundlePath,
  collectDocumentBundle,
  documentBundleZip,
  documentImages,
  type BundleSource,
} from '../src/documents/bundle';

function source(
  documents: Record<string, string>,
  images: Record<string, Uint8Array> = {},
) {
  const reads: string[] = [];
  const result: BundleSource = {
    directory: 'docs',
    paths: Object.keys(documents),
    active: () => true,
    async read(path) {
      reads.push(path);
      if (!(path in documents)) throw Error('文档不存在');
      return documents[path];
    },
    async image(path) {
      reads.push(path);
      if (!(path in images)) throw Error('图片不存在');
      return images[path];
    },
  };
  return { result, reads };
}

test('bundle preserves source, hierarchy, child order and image bytes without following reference links', async () => {
  const markdown = '# 主文档\n[参考](ref.md)\n![图](../../assets/图.png)';
  const image = new Uint8Array([137, 80, 78, 71]);
  const { result, reads } = source(
    {
      'docs/topic/子文档/a.md':
        '# A\n[返回](../index.md)\n![图](../../../assets/图.png)',
      'docs/topic/deep.md': '# 深层\n![重复](../../assets/图.png)',
      'docs/topic/b.md': '# B',
    },
    { 'assets/图.png': image },
  );
  const bundle = await collectDocumentBundle(
    { path: 'docs/topic/index.md', markdown },
    result,
  );
  assert.deepEqual(bundle.failures, []);
  assert.deepEqual(reads, [
    'assets/图.png',
    'docs/topic/子文档/a.md',
    'docs/topic/deep.md',
    'docs/topic/b.md',
  ]);
  const files = unzipSync(documentBundleZip(bundle));
  assert.equal(strFromU8(files['docs/topic/index.md']), markdown);
  assert.deepEqual(files['assets/图.png'], image);
  assert.equal(strFromU8(files['docs/topic/b.md']), '# B');
  assert.equal(Object.keys(files).length, 5);
});

test('missing files and unsafe images are reported while valid files remain exportable', async () => {
  const { result } = source({ 'docs/good.md': '# 正文' });
  result.paths = ['docs/good.md', 'docs/missing.md'];
  const markdown =
    '# 主文档\n![missing](missing.png)\n![unsafe](../../secret.png)';
  const bundle = await collectDocumentBundle(
    { path: 'docs/index.md', markdown },
    result,
  );
  assert.equal(bundle.failures.length, 3);
  const files = unzipSync(documentBundleZip(bundle));
  assert.equal(strFromU8(files['docs/index.md']), markdown);
  assert.match(strFromU8(files['docs/good.md']), /正文/);
  assert.match(strFromU8(files['EXPORT-MISSING.txt']), /missing.md/);
  assert.equal(Object.keys(files).length, 3);
});

test('cancellation after an awaited read prevents any later dependencies from being read', async () => {
  let active = true;
  const { result, reads } = source({});
  result.active = () => active;
  result.paths = ['docs/child.md'];
  result.read = async () => {
    active = false;
    return '---\nchildren: [next.md]\n---';
  };
  await assert.rejects(
    collectDocumentBundle(
      { path: 'docs/index.md', markdown: '---\nchildren: [child.md]\n---' },
      result,
    ),
    { name: 'AbortError' },
  );
  assert.deepEqual(reads, []);
});

test('no children exports the current document and ignores external images and links', async () => {
  const { result, reads } = source({});
  const markdown =
    '# 文档\n[其他](other.md)\n![外部](https://example.com/a.png)\n![内嵌](data:image/png;base64,AA==)';
  const bundle = await collectDocumentBundle(
    { path: 'docs/index.md', markdown },
    result,
  );
  assert.deepEqual(Object.keys(bundle.files), ['docs/index.md']);
  assert.deepEqual(bundle.failures, []);
  assert.deepEqual(reads, []);
});

test('local paths reject absolute paths, encoded traversal and invalid ZIP names', () => {
  for (const path of [
    '../../x.md',
    '%2e%2e/%2e%2e/x.md',
    '%2fx.md',
    'C:/x.md',
    '//host/x.md',
    'a%5cb.md',
    'a%00.md',
    '%zz',
  ])
    assert.throws(() => bundlePath('docs/index.md', path));
  assert.equal(
    bundlePath('docs/topic/index.md', '../a%20b.md#heading'),
    'docs/a b.md',
  );
});

test('Markdown image discovery includes reference images and ignores code samples', () => {
  assert.deepEqual(
    documentImages(
      '![图][image]\n\n[image]: ./a.png\n\n```md\n![示例](fake.png)\n```',
    ),
    ['./a.png'],
  );
});

test('file limit fails instead of silently producing an incomplete archive', async () => {
  const { result } = source(
    Object.fromEntries(
      Array.from({ length: 501 }, (_, i) => [`docs/${i}.md`, '# 子文档']),
    ),
  );
  const markdown = `---\nchildren: [${Array.from({ length: 501 }, (_, i) => `${i}.md`).join(', ')}]\n---`;
  await assert.rejects(
    collectDocumentBundle({ path: 'docs/index.md', markdown }, result),
    /500/,
  );
});

test('archive boundary rejects unsafe document names without reading outside the document library', async () => {
  const { result, reads } = source({});
  result.paths = ['outside.md', 'docs/..\\escape.md'];
  const bundle = await collectDocumentBundle(
    { path: 'docs/main.md', markdown: '# Main' },
    result,
  );
  assert.equal(bundle.failures.length, 2);
  assert.deepEqual(reads, []);
  assert.deepEqual(Object.keys(bundle.files), ['docs/main.md']);
  await assert.rejects(
    collectDocumentBundle({ path: 'docs/..\\escape.md', markdown: '' }, result),
    /路径/,
  );
});

test('a missing main document remains in the failure list and does not prevent an explicit partial export', async () => {
  const { result } = source({ 'docs/child.md': '# Child' });
  const bundle = await collectDocumentBundle({ path: 'docs/main.md' }, result);
  assert.equal(bundle.failures[0].path, 'docs/main.md');
  assert.deepEqual(Object.keys(bundle.files), ['docs/child.md']);
  assert.match(
    strFromU8(unzipSync(documentBundleZip(bundle))['EXPORT-MISSING.txt']),
    /docs\/main.md/,
  );
});
