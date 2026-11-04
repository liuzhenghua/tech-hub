export interface Size {
  width: number;
  height: number;
}
export interface Crop extends Size {
  x: number;
  y: number;
}
export type ImageFormat = 'image/webp' | 'image/jpeg' | 'image/png';
export const MAX_BYTES = 30 * 1024 * 1024;
export const MAX_PIXELS = 24_000_000;
export const MAX_SIDE = 8192;
export function validateImageFile(file: Pick<File, 'size' | 'type'>) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw Error('请选择 PNG、JPEG 或 WebP 静态图片。');
  if (!file.size || file.size > MAX_BYTES)
    throw Error('请选择不超过 30 MB 的非空图片。');
}
export function validateSize(size: Size) {
  if (![size.width, size.height].every((n) => Number.isInteger(n) && n > 0))
    throw Error('图片尺寸无效。');
  if (
    Math.max(size.width, size.height) > MAX_SIDE ||
    size.width * size.height > MAX_PIXELS
  )
    throw Error('图片过大：最长边不能超过 8192 像素，总像素不能超过 2400 万。');
}
export function fitSize(size: Size, longest: number): Size {
  if (!Number.isFinite(longest) || longest < 1)
    throw Error('最长边必须是正整数。');
  const scale = Math.min(
    1,
    Math.floor(longest) / Math.max(size.width, size.height),
  );
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
export function reduction(before: number, after: number) {
  return (1 - after / before) * 100;
}
export function outputName(name: string, suffix: string, format: ImageFormat) {
  const extension = {
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
    'image/png': 'png',
  }[format];
  return `${name.replace(/\.[^.]+$/, '') || 'image'}-${suffix}.${extension}`;
}
