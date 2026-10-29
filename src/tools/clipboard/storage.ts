import { createClipboard, parseClipboard, type ClipboardState } from './model';
const key = 'tool-clipboard-content';
export function loadClipboard(): { state: ClipboardState; error?: string } {
  try {
    const raw = localStorage.getItem(key);
    return {
      state: raw === null ? createClipboard() : parseClipboard(JSON.parse(raw)),
    };
  } catch {
    return {
      state: createClipboard(),
      error: '读取本地剪贴板失败，原有存储未修改。请先检查浏览器存储。',
    };
  }
}
export function saveClipboard(state: ClipboardState): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    throw Error('本地保存失败，请复制重要内容；当前页面内的内容仍保留。');
  }
}
