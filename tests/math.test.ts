import { test } from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { mathMarkdown } from '../src/math-markdown';
const parse = (source: string) => mathMarkdown.parse(source, { async: false });
test('inline and multiline block formulas preserve TeX before Markdown consumes backslashes', () => {
  const html = parse(
    '候选文档 $d$：\n\n$$\n\\operatorname{RRF}(d)=\\sum_i \\frac{1}{k+\\operatorname{rank}_i(d)}\n$$\n\n$i$ 是索引。',
  );
  assert.equal((html.match(/class="math-formula"/g) || []).length, 3);
  assert.match(html, /data-display="true"/);
  assert.match(html, /\\frac\{1\}/);
  assert.match(katex.renderToString('\\sum_i \\frac{1}{60+i}'), /katex/);
});
test('code blocks, code spans, escaped dollars and ordinary currency are not formulas', () => {
  const html = parse(
    '`$x$`\n\n```tex\n$$x^2$$\n```\n\n\\$x\\$\n\n价格 $5 和 $10。',
  );
  assert.doesNotMatch(html, /class="math-formula"/);
});
test('math placeholder escapes attribute injection and malformed formulas stay readable', () => {
  const html = parse('$x"<img src=x onerror=alert(1)>$');
  assert.match(html, /&quot;/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img/);
  assert.match(
    katex.renderToString('\\frac{', { throwOnError: false, trust: false }),
    /katex-error/,
  );
});
