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
    '#copy-markdown,#export-markdown,#export-bundle,#export-pdf',
  );
  const urls: string[] = [];
  function clear() {
    loaded = null;
    onClear();
    actionButtons.forEach((button) => {
      button.disabled = true;
    });
    generation++;
    urls.splice(0).forEach((url) => URL.revokeObjectURL(url));
    elements.body.replaceChildren();
    elements.path.textContent = '';
    elements.outline.replaceChildren();
    elements.outline.hidden = true;
  }
  async function show(path: string, anchor = '') {
    clear();
    const id = generation,
      source = session.source;
    status(session.cache?.get(path) ? '' : '正在加载文档…');
    try {
      const markdown = await session.read(path);
      if (id !== generation) return;
      elements.path.textContent = path.split('/').join(' / ');
      const fragment = markdownFragment(parseFrontMatter(markdown).body);
      const images = [...fragment.querySelectorAll('img')].map((img) => {
        const src = img.getAttribute('src');
        img.removeAttribute('src');
        return { img, src };
      });
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
      for (const { img, src } of images) {
        if (id !== generation) return;
        if (!src || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(src)) {
          img.alt += '（外部图片未自动加载）';
          continue;
        }
        if (!source) {
          img.alt += '（联网后可加载）';
          continue;
        }
        try {
          const image = await source.file(
            resolvePath(path, decodeURIComponent(src)),
            false,
          );
          if (id !== generation) return;
          const ext = image.path.split('.').pop()!.toLowerCase();
          const type = (
            {
              png: 'image/png',
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              gif: 'image/gif',
              webp: 'image/webp',
            } as Record<string, string>
          )[ext];
          if (!type || image.encoding !== 'base64') continue;
          const bytes = Uint8Array.from(
            atob(image.content.replace(/\s/g, '')),
            (char) => char.charCodeAt(0),
          );
          const url = URL.createObjectURL(new Blob([bytes], { type }));
          urls.push(url);
          img.src = url;
        } catch {
          img.alt += '（加载失败）';
        }
      }
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
    }
  }
  return { show, clear, snapshot: () => loaded, dispose: clear };
}
