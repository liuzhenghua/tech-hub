import markup from './panel.html?raw';
import {
  activeCategory,
  addCategory,
  addEntry,
  type ClipboardEntry,
} from './model';
import { loadClipboard, saveClipboard } from './storage';
import { icon } from './icons';
import { mountClipboardDetails } from './details';

export function mountClipboard(root: HTMLElement): () => void {
  root.innerHTML = markup;
  const { state, error } = loadClipboard();
  const events = new AbortController();
  const details = mountClipboardDetails(root);
  root.querySelector('#clipboard-category-form button')!.prepend(icon('plus'));
  root.querySelector('#clipboard-entry-form button')!.prepend(icon('plus'));
  const drafts = new Map<string, string>();
  let disposed = false;
  const node = <T extends HTMLElement>(id: string) =>
    root.querySelector<T>('#clipboard-' + id)!;
  const message = (text: string, failed = false) => {
    node('status').textContent = text;
    node('status').classList.toggle('error', failed);
  };
  function persist() {
    try {
      saveClipboard(state);
      message('已保存到当前浏览器');
    } catch (error) {
      message((error as Error).message, true);
    }
  }
  function button(label: string, action: () => void) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.addEventListener('click', action);
    return element;
  }
  async function copy(entry: ClipboardEntry) {
    try {
      await navigator.clipboard.writeText(entry.text);
      if (!disposed) message('已复制');
    } catch {
      if (!disposed) message('复制失败，请选中文本手动复制。', true);
    }
  }
  function entryRow(entry: ClipboardEntry) {
    const row = document.createElement('div');
    row.className = 'clipboard-entry';
    const text = document.createElement('span');
    text.className = 'clipboard-entry-preview';
    text.textContent = entry.text || '空条目';
    const view = button('', () =>
      details.show(entry, () => {
        text.textContent = entry.text || '空条目';
        persist();
      }),
    );
    view.className = 'clipboard-icon-button';
    view.title = '查看详情';
    view.setAttribute('aria-label', '查看条目详情');
    view.append(icon('eye'));
    const remove = button('', () => {
      const category = activeCategory(state);
      category.entries = category.entries.filter(
        (item) => item.id !== entry.id,
      );
      persist();
      render();
    });
    remove.className = 'clipboard-icon-button clipboard-delete';
    remove.title = '删除条目';
    remove.setAttribute('aria-label', '删除条目');
    remove.append(icon('trash'));
    const copyButton = button('复制', () => void copy(entry));
    copyButton.setAttribute('aria-label', '复制条目');
    copyButton.className = 'clipboard-copy';
    copyButton.prepend(icon('copy'));
    row.append(text, view, remove, copyButton);
    return row;
  }
  function render() {
    const category = activeCategory(state);
    node<HTMLTextAreaElement>('entry-text').value =
      drafts.get(category.id) || '';
    node('title').textContent = category.name;
    node('count').textContent = `${category.entries.length} 条`;
    node('empty').hidden = category.entries.length > 0;
    node('entries').replaceChildren(...category.entries.map(entryRow));
    const categories = state.categories.map((item) => {
      const tab = button(`${item.name} · ${item.entries.length}`, () => {
        state.activeId = item.id;
        persist();
        render();
      });
      tab.setAttribute('aria-pressed', String(item.id === state.activeId));
      return tab;
    });
    node('categories').replaceChildren(...categories);
  }
  function submitCategory(event: Event) {
    event.preventDefault();
    const name = node<HTMLInputElement>('category-name');
    try {
      addCategory(state, name.value, crypto.randomUUID());
      name.value = '';
      persist();
      render();
    } catch (error) {
      message((error as Error).message, true);
    }
  }
  function submitEntry(event: Event) {
    event.preventDefault();
    const text = node<HTMLTextAreaElement>('entry-text');
    try {
      addEntry(state, text.value, crypto.randomUUID());
      text.value = '';
      drafts.delete(state.activeId);
      persist();
      render();
      text.focus();
    } catch (error) {
      message((error as Error).message, true);
    }
  }
  node<HTMLTextAreaElement>('entry-text').addEventListener(
    'input',
    () => {
      drafts.set(state.activeId, node<HTMLTextAreaElement>('entry-text').value);
    },
    { signal: events.signal },
  );
  node('category-form').addEventListener('submit', submitCategory, {
    signal: events.signal,
  });
  node('entry-form').addEventListener('submit', submitEntry, {
    signal: events.signal,
  });
  render();
  if (error) message(error, true);
  return () => {
    disposed = true;
    details.dispose();
    events.abort();
    root.replaceChildren();
  };
}
