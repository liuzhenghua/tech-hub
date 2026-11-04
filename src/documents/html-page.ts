const styles = `
:root { color-scheme: light; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #242c29; background: #f6f5f1; }
* { box-sizing: border-box; }
body { margin: 0; padding: clamp(16px, 4vw, 48px); }
main { max-width: 960px; margin: auto; padding: clamp(20px, 4vw, 48px); background: white; border: 1px solid #d9ded6; border-radius: 12px; font-size: 16px; line-height: 1.85; overflow-wrap: anywhere; }
main > :first-child { margin-top: 0; }
h1 { font-size: clamp(26px, 5vw, 36px); line-height: 1.3; }
h2 { margin-top: 36px; font-size: 25px; line-height: 1.4; }
h3 { margin-top: 28px; font-size: 20px; }
a { color: #2d654a; text-underline-offset: 3px; }
pre { padding: 18px; background: #f1f3ef; border-radius: 8px; overflow-x: auto; font-size: 13px; line-height: 1.65; overflow-wrap: normal; }
code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
:not(pre) > code { padding: 2px 5px; background: #f1f3ef; border-radius: 4px; }
img, svg { max-width: 100%; height: auto; }
.math-formula { font-size: 1.1em; }
.math-formula:has(math[display="block"]) { display: block; overflow-x: auto; padding: 12px 0; }
.document-image, .mermaid { display: block; }
.mermaid { overflow-x: auto; text-align: center; }
.mermaid svg { height: auto; }
table { display: block; overflow-x: auto; border-collapse: collapse; font-size: 14px; }
th, td { padding: 10px 14px; border: 1px solid #d9ded6; text-align: left; }
th { background: #f1f3ef; }
blockquote { margin-left: 0; padding-left: 20px; border-left: 3px solid #2d654a; color: #5f6d63; }
hr { border: 0; border-top: 1px solid #d9ded6; }
.hljs-comment, .hljs-quote { color: #6a737d; }
.hljs-keyword, .hljs-selector-tag { color: #d73a49; }
.hljs-string, .hljs-regexp { color: #032f62; }
.hljs-number, .hljs-literal, .hljs-attr { color: #005cc5; }
.hljs-title, .hljs-section { color: #6f42c1; }
.hljs-type, .hljs-built_in { color: #e36209; }
[hidden] { display: none !important; }
@media print { :root { background: white; } body, main { padding: 0; } main { max-width: none; border: 0; } pre { white-space: pre-wrap; } img, .mermaid { break-inside: avoid; } }
`;

/** content must be sanitized rendered markup with all resources already embedded. */
export function htmlPage(title: string, content: string) {
  const escapedTitle = title.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<title>${escapedTitle}</title>
<style>${styles}</style>
</head>
<body><main>${content}</main></body>
</html>`;
}
