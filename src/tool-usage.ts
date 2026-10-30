const storageKey = 'tool-usage-counts';
export const toolIds = [
  'json',
  'strings',
  'clipboard',
  'markdown',
  'jwt',
  'encoding',
  'digest',
  'crypto',
  'generator',
  'pdf',
] as const;
export type ToolId = (typeof toolIds)[number];
export function readUsage(): Partial<Record<ToolId, number>> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([id, count]) =>
          toolIds.includes(id as ToolId) &&
          Number.isSafeInteger(count) &&
          Number(count) >= 0,
      ),
    );
  } catch {
    return {};
  }
}
export function recordUsage(id: string, initial = false): void {
  if (!toolIds.includes(id as ToolId)) return;
  const navigation = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  if (initial && navigation?.type === 'reload') return;
  const counts = readUsage();
  const key = id as ToolId;
  counts[key] = Math.min((counts[key] || 0) + 1, Number.MAX_SAFE_INTEGER);
  try {
    localStorage.setItem(storageKey, JSON.stringify(counts));
  } catch {
    /* Storage may be unavailable. */
  }
}
