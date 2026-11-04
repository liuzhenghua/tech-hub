import { encodeImage } from '../image-shared/processing';

async function clipboardPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const size = { width: bitmap.width, height: bitmap.height };
    return await encodeImage(
      bitmap,
      { x: 0, y: 0, ...size },
      size,
      'image/png',
      1,
    );
  } finally {
    bitmap.close();
  }
}

export async function copyImage(blob: Blob): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined')
    throw Error('当前浏览器不支持复制图片。');
  // Start the clipboard write during the click, before asynchronous decoding
  // consumes the transient user activation required by some browsers.
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': clipboardPng(blob) }),
  ]);
}
