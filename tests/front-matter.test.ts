import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontMatter } from '../src/documents/front-matter';

test('front matter extracts typed metadata and preserves the body', () => {
  assert.deepEqual(
    parseFrontMatter(
      '\uFEFF---\r\ntitle: "浏览器: 自动化"\r\nstandalone: false # 附属文档\r\n---\r\n# 正文',
    ),
    { title: '浏览器: 自动化', standalone: false, body: '# 正文' },
  );
  for (const value of ['true', 'null', '"false"', '0', '[]']) {
    assert.equal(
      parseFrontMatter(`---\nstandalone: ${value}\n---\n正文`).standalone,
      true,
    );
  }
  assert.deepEqual(parseFrontMatter('---\ntitle: 123\n---\n正文'), {
    title: undefined,
    standalone: true,
    body: '正文',
  });
});

test('invalid or misplaced front matter remains ordinary markdown', () => {
  for (const markdown of [
    '# 正文',
    '\n---\nstandalone: false\n---',
    '---\nstandalone: false',
    '---\nstandalone: [\n---\n正文',
    '---\nstandalone: false\nstandalone: true\n---\n正文',
    '---\n- false\n---\n正文',
  ]) {
    assert.deepEqual(parseFrontMatter(markdown), {
      body: markdown,
      standalone: true,
    });
  }
});
