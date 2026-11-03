import {
  markdownFragment,
  enhanceCodeBlocks,
  renderDiagrams,
} from '../markdown';
import { resolvePath } from './paths';
import { isDocumentPath } from '../document-paths';
import { extractPreview } from './preview';
import { parseFrontMatter } from './front-matter';
import type { DocumentSession } from './session';
import { documentLoading } from '../components/document-loading';
import { prepareDocumentImages } from './images';
export interface ReaderElements {
  body: HTMLElement;
  path: HTMLElement;
  outline: HTMLElement;
}
export function createReader(
  elements: ReaderElements,
  session: DocumentSession,
  status: (text: string, duration?: number) => void,
  open: (path: string, anchor?: string) => void,
  onClear: () => void = () => {},
) {
  let generation = 0;
  let loaded: { path: string; markdown: string } | null = null;
  const actionButtons = document.querySelectorAll<HTMLButtonElement>(
    '#copy-markdown,#export-markdown,#export-html,#export-bundle,#export-pdf',
  );
  let images: ReturnType<typeof prepareDocumentImages> | undefined;
  function clear() {
    loaded = null;
    onClear();
    actionButtons.forEach((button) => {
      button.disabled = true;
    });
    generation++;
    images?.dispose();
    images = undefined;
    elements.body.replaceChildren();
    elements.body.removeAttribute('aria-busy');
    elements.path.textContent = '';
    elements.outline.replaceChildren();
    elements.outline.hidden = true;
  }
  async function show(path: string, anchor = '') {
    clear();
    // Reset before loading so the previous document's scroll position is not reused.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const id = generation;
    status('');
    const loading = documentLoading('reader');
    elements.path.textContent = path.split('/').join(' / ');
    elements.body.setAttribute('aria-busy', 'true');
    elements.body.append(loading);
    try {
      const markdown = await session.read(path);
      if (id !== generation) return;
      elements.path.textContent = path.split('/').join(' / ');
      const fragment = markdownFragment(parseFrontMatter(markdown).body);
      images = prepareDocumentImages(
        fragment,
        path,
        () => session.source,
        () => id === generation,
      );
      for (const node of fragment.querySelectorAll<HTMLAnchorElement>(
        'a[href]',
      )) {
        const href = node.getAttribute('href')!;
        if (/^https?:\/\//i.test(href)) {
          node.target = '_blank';
          node.rel = 'noopener noreferrer';
        } else if (href.startsWith('#')) {
          node.onclick = (event) => {
            event.preventDefault();
            elements.body
              .querySelector(
                `[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`,
              )
              ?.scrollIntoView();
          };
        } else if (
          !/^[a-z][a-z\d+.-]*:/i.test(href) &&
          !href.startsWith('//')
        ) {
          node.href = '#';
          node.onclick = (event) => {
            event.preventDefault();
            const [relative, hash = ''] = href.split('#');
            const resolved = resolvePath(path, decodeURIComponent(relative));
            if (isDocumentPath(resolved, session.config.docsDir ?? 'docs'))
              open(resolved, hash);
            else
              status(
                '链接位于文档目录外或不是 Markdown 文件，请在 GitHub 查看。',
              );
          };
        } else node.removeAttribute('href');
      }
      elements.body.replaceChildren(fragment);
      const imageLoading = images.load();
      enhanceCodeBlocks(elements.body, status);
      const ids = new Map<string, number>();
      for (const heading of elements.body.querySelectorAll<HTMLElement>(
        'h1,h2,h3,h4,h5,h6',
      )) {
        const base = heading.textContent
          .toLowerCase()
          .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
          .replace(/ /g, '-');
        const n = ids.get(base) || 0;
        ids.set(base, n + 1);
        heading.id = base + (n ? `-${n}` : '');
      }
      const headings = elements.body.querySelectorAll<HTMLElement>('h2,h3');
      elements.outline.hidden = !headings.length;
      if (headings.length) {
        const label = document.createElement('strong');
        label.textContent = '本页目录';
        elements.outline.append(label);
        for (const heading of headings) {
          const button = document.createElement('button');
          button.textContent = heading.textContent;
          button.className = heading.tagName === 'H3' ? 'outline-child' : '';
          button.onclick = () => heading.scrollIntoView({ block: 'start' });
          elements.outline.append(button);
        }
      }
      session.record(path, markdown, extractPreview(markdown));
      try {
        await renderDiagrams(elements.body, status, () => id === generation);
      } catch {
        if (id === generation) status('部分 Mermaid 图表无法渲染。');
      }
      await imageLoading;
      if (id !== generation) return;
      loaded = { path, markdown };
      actionButtons.forEach((button) => {
        button.disabled = false;
      });
      if (anchor)
        elements.body
          .querySelector(`[id="${CSS.escape(anchor)}"]`)
          ?.scrollIntoView();
      status('');
    } catch (error) {
      if (id === generation)
        status(error instanceof Error ? error.message : String(error));
    } finally {
      loading.remove();
      if (id === generation) elements.body.removeAttribute('aria-busy');
    }
  }
  return { show, clear, snapshot: () => loaded, dispose: clear };
}
