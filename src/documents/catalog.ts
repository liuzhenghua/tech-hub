import type { DocumentSession } from './session';
import { categoryOf, extractPreview, matchesDocument } from './preview';
export interface CatalogElements {
  categories: HTMLElement;
  search: HTMLInputElement;
  files: HTMLElement;
  total: HTMLElement;
}
export function createCatalog(
  elements: CatalogElements,
  session: DocumentSession,
  open: (path: string) => void,
) {
  let category = '',
    disposed = false,
    generation = 0,
    running = 0;
  const queue = new Set<HTMLElement>(),
    pending = new Set<string>(),
    failed = new Set<string>();
  const observer = new IntersectionObserver(
    (items) => {
      for (const item of items)
        if (item.isIntersecting) queue.add(item.target as HTMLElement);
      pump();
    },
    { rootMargin: '150px' },
  );
  async function load(card: HTMLElement) {
    const path = card.dataset.path!;
    const source = session.source,
      token = generation;
    running++;
    pending.add(path);
    observer.unobserve(card);
    try {
      const markdown = await session.read(path);
      if (disposed || token !== generation || source !== session.source) return;
      session.record(path, markdown, extractPreview(markdown));
      if (card.isConnected) paint(card, path);
    } catch {
      if (token === generation) failed.add(path);
      if (card.isConnected)
        card.querySelector('.document-excerpt')!.textContent =
          '打开查看完整文档';
    } finally {
      running--;
      pending.delete(path);
      pump();
    }
  }
  function pump() {
    if (disposed || !session.source) return;
    for (const card of queue) {
      if (running >= 3) break;
      const path = card.dataset.path!;
      if (pending.has(path)) continue;
      queue.delete(card);
      if (!card.isConnected || session.preview(path) || failed.has(path))
        continue;
      void load(card);
    }
  }
  function paint(card: HTMLElement, path: string) {
    const preview = session.preview(path);
    if (preview?.title) card.querySelector('h3')!.textContent = preview.title;
    card.querySelector('.document-excerpt')!.textContent =
      preview?.text || '打开查看完整文档';
  }
  function render() {
    generation++;
    queue.clear();
    observer.disconnect();
    const entries = session.entries.filter(
        (entry) => session.preview(entry.path)?.standalone !== false,
      ),
      prefix = session.config.docsDir ? session.config.docsDir + '/' : '';
    const categories = [
      ...new Set(
        entries.map((entry) =>
          categoryOf(entry.path, session.config.docsDir || ''),
        ),
      ),
    ];
    if (category && !categories.includes(category)) category = '';
    elements.categories.replaceChildren();
    for (const value of ['', ...categories]) {
      const button = document.createElement('button');
      button.textContent =
        value === '@root'
          ? '根目录'
          : value
            ? value.slice(prefix.length)
            : '全部';
      button.setAttribute('aria-pressed', String(category === value));
      button.onclick = () => {
        category = value;
        render();
      };
      elements.categories.append(button);
    }
    const query = elements.search.value;
    const items = entries.filter((entry) =>
      matchesDocument(
        entry,
        session.preview(entry.path),
        query,
        category,
        session.config.docsDir || '',
      ),
    );
    elements.total.textContent =
      category || query
        ? `${items.length} / ${entries.length} 篇文档`
        : `${entries.length} 篇文档`;
    elements.files.replaceChildren();
    for (const entry of items) {
      const card = document.createElement('button');
      card.className = 'document-card';
      card.dataset.path = entry.path;
      const parts = entry.path.split('/'),
        name = parts.pop()!.replace(/\.md$/i, '');
      const tag = document.createElement('small');
      tag.textContent = parts.join(' / ');
      const title = document.createElement('h3');
      title.textContent =
        session.preview(entry.path)?.title ||
        (name.toLowerCase() === 'readme'
          ? (parts.at(-1) || session.config.repo) + ' · 概览'
          : name);
      const excerpt = document.createElement('p');
      excerpt.className = 'document-excerpt';
      excerpt.textContent =
        session.preview(entry.path)?.text || '正在加载摘要…';
      const footer = document.createElement('span');
      footer.className = 'document-card-footer';
      footer.textContent = '阅读文档 ↗';
      card.append(tag, title, excerpt, footer);
      card.onclick = () => open(entry.path);
      elements.files.append(card);
      if (!session.preview(entry.path)) observer.observe(card);
    }
    if (!items.length) elements.files.textContent = '没有匹配的文档。';
  }
  const search = () => render();
  elements.search.addEventListener('input', search);
  return {
    render,
    reset() {
      failed.clear();
      category = '';
      render();
    },
    dispose() {
      disposed = true;
      generation++;
      queue.clear();
      observer.disconnect();
      elements.search.removeEventListener('input', search);
    },
  };
}
