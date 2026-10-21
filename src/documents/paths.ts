export function resolvePath(current: string, relative: string) {
  const result: string[] = [];
  for (const p of `${current.slice(0, current.lastIndexOf('/') + 1)}${relative}`.split(
    '/',
  )) {
    if (p === '..') result.pop();
    else if (p && p !== '.') result.push(p);
  }
  return result.join('/');
}
