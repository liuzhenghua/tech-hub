import DOMPurify from 'dompurify';
import { encodeBytes } from '../tools/shared/bytes';
import { htmlPage } from './html-page';

async function embedImage(image: HTMLImageElement, signal: AbortSignal) {
  const src = image.getAttribute('src');
  if (!src?.startsWith('blob:') || image.hidden)
    throw Error('部分图片尚未加载成功，请加载或重试图片后再导出 HTML。');
  const response = await fetch(src, { signal });
  if (!response.ok) throw Error('读取图片失败，请重新打开文档后再导出。');
  const blob = await response.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  image.src = `data:${blob.type};base64,${encodeBytes(bytes, 'Base64')}`;
}

function cleanLinks(root: HTMLElement) {
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = link.getAttribute('href')!;
    if (/^https?:\/\//i.test(href)) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } else if (!href.startsWith('#') || href === '#') {
      link.removeAttribute('href');
      link.title = '关联文档未包含在此 HTML 中';
    }
  }
}

export async function exportDocumentHtml(
  rendered: HTMLElement,
  title: string,
  signal: AbortSignal,
) {
  const clone = rendered.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll('.copy-code, .diagram-toolbar')
    .forEach((node) => node.remove());
  for (const frame of clone.querySelectorAll('.document-image')) {
    const placeholder = frame.querySelector('.document-image-placeholder');
    if (placeholder?.textContent?.includes('外部图片未自动加载')) {
      frame.textContent = `外部图片未收录：${frame.querySelector('img')?.alt || ''}`;
    }
  }
  await Promise.all(
    [...clone.querySelectorAll('img')].map((image) =>
      embedImage(image, signal),
    ),
  );
  signal.throwIfAborted();
  clone
    .querySelectorAll('.document-image-placeholder')
    .forEach((node) => node.remove());
  clone.querySelectorAll('.mermaid:not(:has(svg))').forEach(() => {
    throw Error('部分 Mermaid 图表未渲染成功，请重新打开文档后再导出 HTML。');
  });
  cleanLinks(clone);
  for (const node of clone.querySelectorAll('*')) {
    for (const attribute of [...node.attributes]) {
      if (attribute.name.startsWith('data-'))
        node.removeAttribute(attribute.name);
    }
  }
  const content = DOMPurify.sanitize(clone.innerHTML, {
    ADD_TAGS: ['foreignObject'],
    FORBID_TAGS: [
      'script',
      'iframe',
      'object',
      'embed',
      'link',
      'meta',
      'base',
      'form',
      'input',
      'button',
      'video',
      'audio',
      'source',
    ],
    FORBID_ATTR: ['srcset'],
  });
  return htmlPage(title, content);
}

type Snapshot = () => { path: string; markdown: string } | null;

export function mountHtmlExport(
  snapshot: Snapshot,
  status: (text: string, duration?: number) => void,
) {
  const button = document.querySelector<HTMLButtonElement>('#export-html')!;
  const events = new AbortController();
  let task: AbortController | undefined;
  async function run() {
    const current = snapshot();
    if (!current) return;
    task?.abort();
    const controller = new AbortController();
    task = controller;
    const active = () =>
      !events.signal.aborted &&
      !controller.signal.aborted &&
      snapshot() === current;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    document.querySelector<HTMLDetailsElement>('#document-export')!.open =
      false;
    status('正在生成离线 HTML…');
    try {
      const root = document.getElementById('document')!;
      const title =
        root.querySelector('h1')?.textContent ||
        current.path.split('/').pop()!.replace(/\.md$/i, '');
      const html = await exportDocumentHtml(root, title, controller.signal);
      if (!active()) return;
      const url = URL.createObjectURL(
        new Blob([html], { type: 'text/html;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download =
        current.path.split('/').pop()!.replace(/\.md$/i, '') + '.html';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status('已导出离线 HTML，可直接发送给别人阅读。', 4000);
    } catch (error) {
      if (active())
        status(
          error instanceof Error ? error.message : 'HTML 导出失败，请重试。',
        );
    } finally {
      if (task === controller) {
        button.removeAttribute('aria-busy');
        button.disabled = !snapshot();
      }
    }
  }
  button.addEventListener('click', () => void run(), { signal: events.signal });
  return () => {
    events.abort();
    task?.abort();
  };
}
