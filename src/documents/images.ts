import { resolvePath } from './paths';
import type { DocumentSource } from './types';

const imageTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

function imagePlaceholder(img: HTMLImageElement) {
  const frame = document.createElement('span');
  frame.className = 'document-image';
  const placeholder = document.createElement('span');
  placeholder.className = 'document-image-placeholder';
  const label = document.createElement('span');
  label.setAttribute('role', 'status');
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = '重试';
  retry.hidden = true;
  placeholder.append(label, retry);
  img.hidden = true;
  img.replaceWith(frame);
  frame.append(placeholder, img);
  return { frame, placeholder, label, retry };
}

/** Hide unready images so the browser never renders a broken-image icon while fetching. */
export function prepareDocumentImages(
  root: ParentNode,
  path: string,
  source: () => DocumentSource | null,
  active: () => boolean,
) {
  let disposed = false;
  const urls = new Set<string>();
  const current = () => !disposed && active();
  const events = new AbortController();
  const items = [...root.querySelectorAll('img')].map(prepare);

  function prepare(img: HTMLImageElement) {
    const src = img.getAttribute('src');
    img.removeAttribute('src');
    const { frame, placeholder, label, retry } = imagePlaceholder(img);
    let pending = false;
    function state(message: string, busy: boolean, canRetry = false) {
      label.textContent = message;
      frame.setAttribute('aria-busy', String(busy));
      retry.hidden = !canRetry;
    }
    state('图片加载中…', true);
    async function load() {
      if (!current() || pending) return;
      if (!src || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(src)) {
        state('外部图片未自动加载', false);
        return;
      }
      const repository = source();
      if (!repository) {
        state('正在连接仓库，图片稍后显示…', true);
        return;
      }
      pending = true;
      state('图片加载中…', true);
      let url: string | undefined;
      try {
        const image = await repository.file(
          resolvePath(path, decodeURIComponent(src)),
          false,
        );
        if (!current()) return;
        const type = imageTypes[image.path.split('.').pop()!.toLowerCase()];
        if (!type || image.encoding !== 'base64')
          throw Error('不支持的图片内容');
        const bytes = Uint8Array.from(
          atob(image.content.replace(/\s/g, '')),
          (char) => char.charCodeAt(0),
        );
        url = URL.createObjectURL(new Blob([bytes], { type }));
        urls.add(url);
        img.src = url;
        await img.decode();
        if (!current()) return;
        img.hidden = false;
        placeholder.hidden = true;
        frame.setAttribute('aria-busy', 'false');
      } catch {
        if (url) {
          URL.revokeObjectURL(url);
          urls.delete(url);
        }
        if (current()) {
          img.removeAttribute('src');
          state('图片加载失败', false, true);
        }
      } finally {
        pending = false;
      }
    }
    retry.addEventListener(
      'click',
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        void load();
      },
      { signal: events.signal },
    );
    return { load };
  }

  return {
    async load() {
      let cursor = 0;
      async function worker() {
        while (cursor < items.length && current()) await items[cursor++].load();
      }
      await Promise.all(
        Array.from({ length: Math.min(3, items.length) }, worker),
      );
    },
    dispose() {
      disposed = true;
      events.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    },
  };
}
