export interface DiffDraft {
  left: string;
  right: string;
  mode: 'text' | 'json';
  view: 'split' | 'unified';
  wrap: boolean;
  hideSame: boolean;
}
const key = 'tool-diff-draft';
export function readDiffDraft(): DiffDraft | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || 'null');
    if (!value || typeof value !== 'object') return null;
    const data = value as Record<string, unknown>;
    if (typeof data.left !== 'string' || typeof data.right !== 'string')
      return null;
    return {
      left: data.left,
      right: data.right,
      mode: data.mode === 'json' ? 'json' : 'text',
      view: data.view === 'unified' ? 'unified' : 'split',
      wrap: data.wrap !== false,
      hideSame: data.hideSame === true,
    };
  } catch {
    return null;
  }
}
export function writeDiffDraft(draft: DiffDraft): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
