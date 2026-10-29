export interface ClipboardEntry {
  id: string;
  text: string;
}
export interface ClipboardCategory {
  id: string;
  name: string;
  entries: ClipboardEntry[];
}
export interface ClipboardState {
  activeId: string;
  categories: ClipboardCategory[];
}
export function createClipboard(): ClipboardState {
  return {
    activeId: 'default',
    categories: [{ id: 'default', name: '默认', entries: [] }],
  };
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}
function parseEntry(value: unknown): ClipboardEntry {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    !value.id ||
    typeof value.text !== 'string'
  )
    throw Error('剪贴板条目格式无效');
  return { id: value.id, text: value.text };
}
function parseCategory(value: unknown): ClipboardCategory {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    !value.id ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    !Array.isArray(value.entries)
  )
    throw Error('剪贴板类目格式无效');
  const entries = value.entries.map(parseEntry);
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length)
    throw Error('剪贴板条目 ID 重复');
  return { id: value.id, name: value.name.trim(), entries };
}
export function parseClipboard(value: unknown): ClipboardState {
  if (
    !record(value) ||
    !Array.isArray(value.categories) ||
    !value.categories.length
  )
    throw Error('剪贴板内容格式无效');
  const categories = value.categories.map(parseCategory);
  if (
    new Set(categories.map((category) => category.id)).size !==
    categories.length
  )
    throw Error('剪贴板类目 ID 重复');
  const activeId = categories.some((category) => category.id === value.activeId)
    ? String(value.activeId)
    : categories[0].id;
  return { activeId, categories };
}
export function addCategory(
  state: ClipboardState,
  name: string,
  id: string,
): void {
  const trimmed = name.trim();
  if (!trimmed) throw Error('请输入类目名称');
  if (state.categories.some((category) => category.name === trimmed))
    throw Error('类目已存在');
  state.categories.push({ id, name: trimmed, entries: [] });
  state.activeId = id;
}
export function activeCategory(state: ClipboardState): ClipboardCategory {
  return state.categories.find((category) => category.id === state.activeId)!;
}
export function addEntry(
  state: ClipboardState,
  text: string,
  id: string,
): void {
  if (!text.trim()) throw Error('请输入条目内容');
  activeCategory(state).entries.push({ id, text });
}
