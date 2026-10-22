import type { PDFDocumentProxy } from 'pdfjs-dist';

/** Render from the PDF source; thumbnails never determine export resolution. */
export async function renderPagePng(
  pdf: PDFDocumentProxy,
  number: number,
  dpi: number,
): Promise<Blob> {
  const page = await pdf.getPage(number);
  const viewport = page.getViewport({ scale: dpi / 72 });
  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);
  // Fail explicitly instead of silently reducing the requested resolution.
  if (width > 16384 || height > 16384 || width * height > 64_000_000)
    throw Error(`第 ${number} 页尺寸过大，请降低导出清晰度。`);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw Error('无法创建图片画布');
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(Error('图片生成失败，请降低清晰度后重试')),
        'image/png',
      ),
    );
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
