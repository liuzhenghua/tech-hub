export function repairJSONStrings(text: string) {
  const controls: Record<string, string> = {
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
    '\b': '\\b',
    '\f': '\\f',
  };
  const valid = '"\\/bfnrt',
    end = ':,}]';
  let result = '',
    i = 0;
  while (i < text.length) {
    if (text[i] !== '"') {
      result += text[i++];
      continue;
    }
    result += '"';
    i++;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '\\') {
        i++;
        if (i < text.length) {
          const next = text[i];
          if (next === 'u' && i + 4 < text.length) {
            result += '\\u' + text.slice(i + 1, i + 5);
            i += 5;
          } else if (valid.includes(next)) {
            result += '\\' + next;
            i++;
          } else {
            result += '\\\\' + next;
            i++;
          }
        } else result += '\\\\';
        continue;
      }
      if (ch === '"') {
        let j = i + 1;
        while (j < text.length && ' \t\n\r'.includes(text[j])) j++;
        if (j >= text.length || end.includes(text[j])) {
          result += '"';
          i++;
          break;
        }
        result += '\\"';
        i++;
        continue;
      }
      result +=
        controls[ch] ??
        (ch.charCodeAt(0) < 32
          ? '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')
          : ch);
      i++;
    }
  }
  return result;
}
// Keep behavior aligned with tools/macos/cot-editor string scripts.

export function formatJSON(
  value: string,
  action: string,
  indent: string,
): string {
  return JSON.stringify(
    JSON.parse(action === 'repair' ? repairJSONStrings(value) : value),
    null,
    action === 'minify' ? undefined : indent === 'tab' ? '\t' : Number(indent),
  );
}
