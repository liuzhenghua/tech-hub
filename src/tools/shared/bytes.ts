export const encoder = new TextEncoder();
export const decoder = new TextDecoder('utf-8', { fatal: true });
export function fromBase64(value: string) {
  let normalized = value.replace(/\s/g, '');
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?|)?$/.test(
      normalized,
    )
  )
    throw new Error('Base64 格式无效，请输入标准 Base64 字符串。');
  return Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0));
}
export function encodeBytes(bytes: Uint8Array, format: string) {
  if (format === 'Hex')
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  let text = '';
  for (let i = 0; i < bytes.length; i += 32768)
    text += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(text);
}
export function decodeBytes(value: string, format: string) {
  if (format === 'UTF-8') return encoder.encode(value);
  if (format === 'Base64') return fromBase64(value);
  const hex = value.replace(/\s/g, '');
  if (hex.length % 2 || !/^[0-9a-f]*$/i.test(hex))
    throw new Error('Hex 格式无效。');
  return Uint8Array.from(hex.match(/../g) ?? [], (v) => parseInt(v, 16));
}
