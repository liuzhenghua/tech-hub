import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlPage } from '../src/documents/html-page';

test('untrusted document titles cannot escape the HTML title element', () => {
  const html = htmlPage(
    '</title><script>alert("x")</script>&\'中文',
    '<h1>文档</h1>',
  );
  assert.ok(
    html.includes(
      '&lt;/title&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;中文',
    ),
  );
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.equal((html.match(/<script/g) || []).length, 0);
  assert.ok(html.includes('<main><h1>文档</h1></main>'));
});

test('offline HTML restricts resource loading and carries its own responsive and print styles', () => {
  const html = htmlPage('文档', '<p>内容</p>');
  assert.match(
    html,
    /default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'/,
  );
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /@media print/);
  assert.doesNotMatch(html, /<(script|link)\b/);
});
