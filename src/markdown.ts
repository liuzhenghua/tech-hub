import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import 'highlight.js/styles/github.css';
import { enhanceDiagrams } from './diagrams';
export function markdownFragment(markdown: string) {
  return DOMPurify.sanitize(marked.parse(markdown, { async: false }), {
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: [
      'style',
      'iframe',
      'form',
      'input',
      'video',
      'audio',
      'source',
      'svg',
      'math',
      'link',
      'object',
      'embed',
      'picture',
    ],
    FORBID_ATTR: ['style', 'srcset'],
  });
}
export function enhanceCodeBlocks(
  root: HTMLElement,
  status: (message: string) => void = () => {},
) {
  for (const pre of root.querySelectorAll('pre')) {
    const code = pre.querySelector('code');
    if (!code || code.classList.contains('language-mermaid')) continue;
    const language = [...code.classList]
      .find((name) => name.startsWith('language-'))
      ?.slice(9);
    // Unknown languages remain readable plain text; avoid expensive auto-detection.
    if (language && hljs.getLanguage(language)) hljs.highlightElement(code);
    const button = document.createElement('button');
    button.className = 'copy-code';
    const copyIcon =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';
    button.innerHTML = copyIcon;
    button.title = '复制代码';
    button.setAttribute('aria-label', '复制代码');
    button.onclick = async () => {
      try {
        await navigator.clipboard.writeText(code.textContent);
        button.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
        button.setAttribute('aria-label', '已复制');
      } catch {
        button.setAttribute('aria-label', '复制失败');
        status('浏览器未允许复制，请选中代码后手动复制。');
      }
      setTimeout(() => {
        button.innerHTML = copyIcon;
        button.setAttribute('aria-label', '复制代码');
      }, 2000);
    };
    pre.append(button);
  }
}
export async function renderMarkdown(
  root: HTMLElement,
  markdown: string,
  status: (message: string) => void = () => {},
) {
  const fragment = markdownFragment(markdown);
  fragment.querySelectorAll('img').forEach((img) => img.removeAttribute('src'));
  root.replaceChildren(fragment);
  enhanceCodeBlocks(root, status);
  await renderDiagrams(root, status);
}
export async function renderDiagrams(
  root: HTMLElement,
  status: (message: string) => void,
  isCurrent: () => boolean = () => true,
) {
  const nodes = [];
  for (const code of root.querySelectorAll('code.language-mermaid')) {
    const node = document.createElement('div');
    node.className = 'mermaid';
    node.dataset.source = code.textContent;
    node.textContent = code.textContent;
    code.parentElement!.replaceWith(node);
    nodes.push(node);
  }
  if (nodes.length) {
    const { default: mermaid } = await import('mermaid');
    if (!isCurrent()) return;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'neutral',
    });
    await mermaid.run({ nodes });
    if (isCurrent()) enhanceDiagrams(root, status);
  }
}
