export interface DiffLine {
  kind: 'same' | 'remove' | 'add';
  text: string;
  left?: number;
  right?: number;
}
function sortedJSON(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedJSON);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => [key, sortedJSON(item)]),
  );
}
export function normalizeJSON(value: string): string {
  const parsed = JSON.parse(value, (_key, item: unknown) => {
    if (
      typeof item === 'number' &&
      (!Number.isFinite(item) ||
        (Number.isInteger(item) && !Number.isSafeInteger(item)))
    )
      throw Error(
        'JSON 包含超出安全整数范围的数值，请先改为字符串，避免精度丢失。',
      );
    return item;
  });
  return JSON.stringify(sortedJSON(parsed), null, 2);
}
export function compareLines(left: string, right: string): DiffLine[] {
  const a = left === '' ? [] : left.replace(/\r\n/g, '\n').split('\n');
  const b = right === '' ? [] : right.replace(/\r\n/g, '\n').split('\n');
  if (
    a.length > 4000 ||
    b.length > 4000 ||
    (a.length + 1) * (b.length + 1) > 4_000_000
  )
    throw Error('行数过多，请缩小对比范围（每侧约 2,000 行以内）。');
  const width = b.length + 1;
  const lengths = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i * width + j] =
        a[i] === b[j]
          ? lengths[(i + 1) * width + j + 1] + 1
          : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
    }
  }
  const lines: DiffLine[] = [];
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push({ kind: 'same', text: a[i], left: ++i, right: ++j });
    } else if (
      i < a.length &&
      (j === b.length ||
        lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])
    ) {
      lines.push({ kind: 'remove', text: a[i], left: ++i });
    } else lines.push({ kind: 'add', text: b[j], right: ++j });
  }
  return lines;
}
