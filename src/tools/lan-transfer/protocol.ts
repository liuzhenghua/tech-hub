export const MAX_FILE_SIZE = 256 * 1000 * 1000;
export const CHUNK_SIZE = 16 * 1024;
export type Control =
  | { type: 'file'; name: string; size: number }
  | { type: 'accept' | 'reject' | 'end' | 'received' };
export function parseControl(text: string): Control {
  if (text.length > 4096) throw Error('传输消息过长。');
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object') throw Error('无效的传输消息。');
  if (['accept', 'reject', 'end', 'received'].includes(value.type))
    return { type: value.type };
  if (
    value.type !== 'file' ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > 255 ||
    !Number.isSafeInteger(value.size) ||
    value.size < 0 ||
    value.size > MAX_FILE_SIZE
  )
    throw Error('文件信息无效或超过 256 MB。');
  return { type: 'file', name: value.name, size: value.size };
}
export function safeName(name: string): string {
  return name.replace(/[\\/\u0000-\u001f\u007f]/g, '_').replace(/^\.+$/, '_');
}
