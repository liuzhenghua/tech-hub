import type { DocumentSession } from './session';
import type { DocumentGroup } from './groups';
import { matchingGroupDocuments } from './groups';
import { categoryOf } from './preview';

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
    indexing = false;
  let failures: string[] = [];
  const events = new AbortController();
  function cardFor(group: DocumentGroup, query: string) {
    const path = group.entry.path;
    const preview = session.preview(path);
    const card = document.createElement('button');
    card.className = 'document-card';
    card.dataset.path = path;
    const parts = path.split('/');
    const name = parts.pop()!.replace(/\.md$/i, '');
    const tag = document.createElement('small');
    tag.textContent = parts.join(' / ');
    const title = document.createElement('h3');
    title.textContent =
      preview?.title ||
      (name.toLowerCase() === 'readme'
        ? (parts.at(-1) || session.config.repo) + ' · 概览'
        : name);
    const excerpt = document.createElement('p');
    excerpt.className = 'document-excerpt';
    excerpt.textContent = preview?.text || '打开查看完整文档';
    const footer = document.createElement('span');
    footer.className = 'document-card-footer';
    footer.textContent = group.children.length
      ? `阅读文档 ↗ · ${group.children.length} 篇子文档`
      : '阅读文档 ↗';
    card.append(tag, title, excerpt);
    const matches = matchingGroupDocuments(
      group,
      (path) => session.preview(path),
      query,
    ).filter((entry) => entry.path !== path);
    if (matches.length) {
      const hint = document.createElement('p');
      hint.className = 'document-match';
      hint.textContent =
        '命中子文档：' +
        matches
          .map(
            (entry) =>
              session.preview(entry.path)?.title || entry.path.split('/').pop(),
          )
          .join('、');
      card.append(hint);
    }
    card.append(footer);
    card.onclick = () => open(path);
    return card;
  }
  function renderCategories(groups: DocumentGroup[]) {
    const directory = session.config.docsDir || '';
    const prefix = directory ? directory + '/' : '';
    const categories = [
      ...new Set(
        groups.map((group) => categoryOf(group.entry.path, directory)),
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
  }
  function renderFailures() {
    if (!failures.length) return;
    const notice = document.createElement('div');
    notice.className = 'document-index-notice';
    const summary = document.createElement('div');
    summary.className = 'document-index-summary';
    const message = document.createElement('span');
    message.textContent = `${failures.length} 篇文档暂未更新，搜索结果可能不完整。`;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = '重试';
    retry.onclick = () => void index();
    summary.append(message, retry);
    const details = document.createElement('details');
    const label = document.createElement('summary');
    label.textContent = '查看详情';
    const list = document.createElement('ul');
    for (const path of failures) {
      const item = document.createElement('li');
      item.textContent = path;
      list.append(item);
    }
    details.append(label, list);
    notice.append(summary, details);
    elements.files.prepend(notice);
  }

  function render() {
    if (disposed) return;
    elements.files.replaceChildren();
    elements.files.setAttribute('aria-busy', String(indexing));
    const groups = session
      .groups()
      .filter((group) => session.preview(group.entry.path));
    renderCategories(groups);
    const query = elements.search.value;
    const items = groups.filter(
      (group) =>
        (!category ||
          categoryOf(group.entry.path, session.config.docsDir || '') ===
            category) &&
        (!query.trim() ||
          matchingGroupDocuments(group, (path) => session.preview(path), query)
            .length > 0),
    );
    elements.total.textContent =
      category || query
        ? `${items.length} / ${groups.length} 篇主文档`
        : `${groups.length} 篇主文档`;
    if (indexing) elements.total.textContent += ' · 更新中';
    for (const group of items) elements.files.append(cardFor(group, query));
    if (!items.length)
      elements.files.textContent = indexing
        ? '正在加载文档…'
        : '没有匹配的文档。';
    renderFailures();
  }
  async function index() {
    const id = ++generation;
    failures = [];
    if (!session.source) {
      indexing = false;
      render();
      return;
    }
    indexing = true;
    render();
    try {
      const missing = await session.buildIndex();
      if (disposed || id !== generation) return;
      failures = missing;
    } catch (error) {
      if (disposed || id !== generation) return;
      failures =
        error instanceof Error && error.name === 'AbortError'
          ? []
          : session.entries.map((entry) => entry.path);
    }
    if (disposed || id !== generation) return;
    indexing = false;
    render();
  }
  elements.search.addEventListener('input', render, { signal: events.signal });
  return {
    render,
    reset() {
      category = '';
      void index();
    },
    dispose() {
      disposed = true;
      generation++;
      events.abort();
    },
  };
}
