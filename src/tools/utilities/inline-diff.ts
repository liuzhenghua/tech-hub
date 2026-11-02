export interface TextPart {
  text: string;
  changed: boolean;
}
/** Compare Unicode code points; bound the matrix for very long lines. */
export function inlineDiff(
  left: string,
  right: string,
): [TextPart[], TextPart[]] {
  const a = Array.from(left),
    b = Array.from(right);
  let prefix = 0,
    suffix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix])
    prefix++;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - suffix - 1] === b[b.length - suffix - 1]
  )
    suffix++;
  const x = a.slice(prefix, a.length - suffix),
    y = b.slice(prefix, b.length - suffix);
  const parts: [TextPart[], TextPart[]] = [[], []];
  const append = (side: number, text: string, changed: boolean) => {
    if (!text) return;
    const previous = parts[side].at(-1);
    if (previous?.changed === changed) previous.text += text;
    else parts[side].push({ text, changed });
  };
  append(0, a.slice(0, prefix).join(''), false);
  append(1, b.slice(0, prefix).join(''), false);
  if ((x.length + 1) * (y.length + 1) > 250_000) {
    append(0, x.join(''), true);
    append(1, y.join(''), true);
  } else compareMiddle(x, y, append);
  append(0, a.slice(a.length - suffix).join(''), false);
  append(1, b.slice(b.length - suffix).join(''), false);
  return parts;
}
function compareMiddle(
  a: string[],
  b: string[],
  append: (side: number, text: string, changed: boolean) => void,
) {
  const width = b.length + 1;
  const matrix = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--)
      matrix[i * width + j] =
        a[i] === b[j]
          ? matrix[(i + 1) * width + j + 1] + 1
          : Math.max(matrix[(i + 1) * width + j], matrix[i * width + j + 1]);
  }
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      append(0, a[i++], false);
      append(1, b[j++], false);
    } else if (
      i < a.length &&
      (j === b.length ||
        matrix[(i + 1) * width + j] >= matrix[i * width + j + 1])
    )
      append(0, a[i++], true);
    else append(1, b[j++], true);
  }
}
