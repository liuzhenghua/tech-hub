export interface RegexDraft {
  pattern: string;
  text: string;
  flags: string;
}
const key = 'tool-regex-draft';
export function readRegexDraft(): RegexDraft | null {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) || 'null');
    if (!data || typeof data !== 'object') return null;
    const value = data as Record<string, unknown>;
    if (
      typeof value.pattern !== 'string' ||
      typeof value.text !== 'string' ||
      typeof value.flags !== 'string' ||
      !/^[gimsuy]*$/.test(value.flags)
    )
      return null;
    return { pattern: value.pattern, text: value.text, flags: value.flags };
  } catch {
    return null;
  }
}
export function writeRegexDraft(draft: RegexDraft): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
