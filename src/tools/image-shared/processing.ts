import { validateSize, type Crop, type ImageFormat, type Size } from './model';
export interface ImageAsset {
  file: File;
  bitmap: ImageBitmap;
  url: string;
}
export async function encodeImage(
  bitmap: ImageBitmap,
  crop: Crop,
  size: Size,
  format: ImageFormat,
  quality: number,
) {
  validateSize(size);
  if (!Number.isFinite(quality) || quality < 0.1 || quality > 1)
    throw Error('质量必须在 10–100 之间。');
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw Error('当前浏览器无法处理图片。');
  if (format === 'image/jpeg') {
    context.fillStyle = '#fff';
    context.fillRect(0, 0, size.width, size.height);
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    bitmap,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    size.width,
    size.height,
  );
  try {
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(Error('图片编码失败，请降低尺寸后重试。')),
        format,
        quality,
      ),
    );
    if (blob.type !== format)
      throw Error('当前浏览器不支持此导出格式，请更换格式。');
    return blob;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
export function downloadImage(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function element<T extends HTMLElement = HTMLElement>(
  root: ParentNode,
  id: string,
): T {
  const node = root.querySelector<T>(`#${id}`);
  if (!node) throw Error(`缺少图片工具元素：${id}`);
  return node;
}
