import type { DiffLine } from './diff';

export type DiffPair = [DiffLine | undefined, DiffLine | undefined];

/** Align unchanged content before pairing edits, so indentation and blank lines
 * cannot shift every subsequent inline comparison. Preserve source order. */
export function alignChangedLines(
  removed: DiffLine[],
  added: DiffLine[],
): DiffPair[] {
  const left = removed.map((line) => line.text.trim());
  const right = added.map((line) => line.text.trim());
  const width = right.length + 1;
  const lengths = new Uint16Array((left.length + 1) * width);
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      lengths[i * width + j] =
        left[i] === right[j]
          ? lengths[(i + 1) * width + j + 1] + 1
          : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
    }
  }
  const pairs: DiffPair[] = [];
  let i = 0,
    j = 0,
    startLeft = 0,
    startRight = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      pairs.push(...pairGap(removed, added, startLeft, i, startRight, j));
      pairs.push([removed[i++], added[j++]]);
      startLeft = i;
      startRight = j;
    } else if (lengths[(i + 1) * width + j] >= lengths[i * width + j + 1]) i++;
    else j++;
  }
  pairs.push(
    ...pairGap(
      removed,
      added,
      startLeft,
      left.length,
      startRight,
      right.length,
    ),
  );
  return pairs;
}

function pairGap(
  removed: DiffLine[],
  added: DiffLine[],
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): DiffPair[] {
  return Array.from(
    { length: Math.max(leftEnd - leftStart, rightEnd - rightStart) },
    (_, offset) => [
      leftStart + offset < leftEnd ? removed[leftStart + offset] : undefined,
      rightStart + offset < rightEnd ? added[rightStart + offset] : undefined,
    ],
  );
}
