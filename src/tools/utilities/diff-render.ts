import type { DiffLine } from './diff';
import { inlineDiff, type TextPart } from './inline-diff';
function cell(
  line: DiffLine | undefined,
  side: 'left' | 'right',
  parts?: TextPart[],
): HTMLElement {
  const node = document.createElement('div');
  node.className = 'diff-cell ' + (line?.kind ?? 'empty');
  const number = document.createElement('span');
  number.className = 'diff-number';
  number.textContent = String(line?.[side] ?? '');
  const code = document.createElement('code');
  code.textContent = line
    ? `${line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ' '} ${line.text}`
    : '';
  if (parts && line) {
    code.textContent = line.kind === 'add' ? '+ ' : '− ';
    for (const part of parts) {
      const span = document.createElement('span');
      if (part.changed) span.className = 'diff-inline-change';
      span.textContent = part.text;
      code.append(span);
    }
  }
  node.append(number, code);
  return node;
}
function row(
  left: DiffLine | undefined,
  right: DiffLine | undefined,
): HTMLElement {
  const node = document.createElement('div');
  node.className = 'diff-row';
  const parts =
    left?.kind === 'remove' && right?.kind === 'add'
      ? inlineDiff(left.text, right.text)
      : undefined;
  node.append(cell(left, 'left', parts?.[0]), cell(right, 'right', parts?.[1]));
  return node;
}
function changedRows(
  lines: DiffLine[],
  start: number,
  unified: boolean,
): { rows: HTMLElement[]; next: number } {
  const removed: DiffLine[] = [],
    added: DiffLine[] = [];
  let next = start;
  while (next < lines.length && lines[next].kind !== 'same') {
    (lines[next].kind === 'remove' ? removed : added).push(lines[next++]);
  }
  if (unified) {
    const parts = removed.map((line, i) =>
      added[i] ? inlineDiff(line.text, added[i].text) : undefined,
    );
    return {
      rows: [
        ...removed.map((line, i) => cell(line, 'left', parts[i]?.[0])),
        ...added.map((line, i) => cell(line, 'right', parts[i]?.[1])),
      ],
      next,
    };
  }
  const rows = Array.from(
    { length: Math.max(removed.length, added.length) },
    (_, i) => row(removed[i], added[i]),
  );
  return { rows, next };
}
export function renderDiff(
  root: HTMLElement,
  lines: DiffLine[],
  unified: boolean,
  hideSame: boolean,
  wrap: boolean,
) {
  root.classList.toggle('diff-no-wrap', !wrap);
  root.dataset.emptyMessage = hideSame
    ? '没有差异行，相同内容已隐藏。'
    : '两侧内容均为空。';
  const fragment = document.createDocumentFragment();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.kind === 'same' && hideSame) {
      i++;
      continue;
    }
    if (unified && line.kind === 'same') {
      fragment.append(cell(line, 'left'));
      i++;
      continue;
    }
    if (line.kind === 'same') {
      fragment.append(row(line, line));
      i++;
      continue;
    }
    const group = changedRows(lines, i, unified);
    fragment.append(...group.rows);
    i = group.next;
  }
  root.replaceChildren(fragment);
}
