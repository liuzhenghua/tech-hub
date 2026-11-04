import { Marked, type TokenizerAndRendererExtension } from 'marked';

const escapeAttribute = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
function mathExtension(display: boolean): TokenizerAndRendererExtension {
  const name = display ? 'blockMath' : 'inlineMath';
  return {
    name,
    level: display ? 'block' : 'inline',
    start: (src) => src.indexOf(display ? '$$' : '$'),
    tokenizer(src) {
      const match = display
        ? /^\$\$[ \t]*\n?([\s\S]+?)\$\$(?:[ \t]*(?:\n|$))/.exec(src)
        : /^\$(?!\$)([^\s$](?:\\[^\n]|[^$\n\\])*?[^\s$\\]|[^\s$])\$(?!\d)/.exec(
            src,
          );
      if (match) return { type: name, raw: match[0], text: match[1], display };
    },
    renderer(token) {
      const tag = display ? 'div' : 'span';
      return `<${tag} class="math-formula" data-math="${escapeAttribute(token.text)}" data-display="${display}">${escapeAttribute(token.raw)}</${tag}>`;
    },
  };
}
export const mathMarkdown = new Marked({
  extensions: [mathExtension(true), mathExtension(false)],
});
