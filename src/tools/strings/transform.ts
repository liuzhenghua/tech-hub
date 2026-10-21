import { encoder, decoder, fromBase64, encodeBytes } from '../shared/bytes';
export function escapeString(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}
export function unescapeString(value: string) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"'))
    value = value.slice(1, -1);
  const replacements: Record<string, string> = {
    '\\n': '\n',
    '\\t': '\t',
    '\\"': '"',
    '\\\\': '\\',
  };
  return value.replace(/\\[nt"\\]/g, (match) => replacements[match]);
}
export function singleToDoubleQuotes(value: string) {
  let output = '',
    i = 0;
  while (i < value.length) {
    if (value[i] !== "'") {
      output += value[i++];
      continue;
    }
    let j = i + 1;
    while (j < value.length) {
      if (value[j] === '\\' && j + 1 < value.length) {
        j += 2;
        continue;
      }
      if (value[j] === "'") break;
      j++;
    }
    let inner = value.slice(i + 1, j);
    inner = inner
      .replace(/\\"/g, '\x00')
      .replace(/"/g, '\\"')
      .replace(/\x00/g, '\\"');
    inner = inner.replace(/\\\\'/g, '\\\\').replace(/\\'/g, "'");
    output += '"' + inner + '"';
    i = j + 1;
  }
  return output;
}

export function transformString(value: string, action: string): string {
  switch (action) {
    case 'escape':
      return escapeString(value);
    case 'unescape':
      return unescapeString(value);
    case 'quotes':
      return singleToDoubleQuotes(value);
    case 'base64-encode':
      return encodeBytes(encoder.encode(value), 'Base64');
    case 'base64-decode':
      return decoder.decode(fromBase64(value));
    default:
      throw Error('未知字符串操作');
  }
}
