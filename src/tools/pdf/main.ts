import { recordUsage } from '../../tool-usage';
recordUsage('pdf', true);
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { renderPagePng } from './render';
import { mountPagePreview } from './preview';
type PageImage = { page: number; blob: Blob; url: string };
type ImageItem = { file: File; url: string };
const root = document.querySelector<HTMLElement>('main')!;
const pdfInput = root.querySelector<HTMLInputElement>('#pdf-file')!;
const imageInput = root.querySelector<HTMLInputElement>('#image-files')!;
const pagesNode = root.querySelector<HTMLElement>('#pdf-pages')!;
const selectAll = root.querySelector<HTMLInputElement>('#select-all')!;
const downloadSelected =
  root.querySelector<HTMLButtonElement>('#download-selected')!;
const imageList = root.querySelector<HTMLOListElement>('#image-list')!;
const makePdf = root.querySelector<HTMLButtonElement>('#make-pdf')!;
const status = root.querySelector<HTMLElement>('#status')!;
const events = new AbortController();
const pages = new Map<number, PageImage>();
const selected = new Set<number>();
const images: ImageItem[] = [];
let generation = 0;
let documentPdf: PDFDocumentProxy | undefined;
let exporting = false;
const mode = root.querySelector<HTMLSelectElement>('#pdf-mode')!;
const disposeTabs = mountOptionTabs(mode);
const node = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
const preview = mountPagePreview({
  document: () => documentPdf,
  selected: (page) => selected.has(page),
  select: (page, value) => {
    value ? selected.add(page) : selected.delete(page);
    renderPages();
  },
});
mode.addEventListener(
  'change',
  () => {
    node('split-panel').hidden = mode.value !== 'split';
    node('merge-panel').hidden = mode.value !== 'merge';
    node('mode-hint').textContent =
      mode.value === 'split'
        ? '选择 PDF，勾选需要保存的页面'
        : '添加图片，调整顺序后合并下载';
    message('');
  },
  { signal: events.signal },
);
node('pick-pdf').addEventListener('click', () => pdfInput.click(), {
  signal: events.signal,
});
node('pdf-empty').addEventListener('click', () => pdfInput.click(), {
  signal: events.signal,
});
node('pick-images').addEventListener('click', () => imageInput.click(), {
  signal: events.signal,
});
node('image-empty').addEventListener('click', () => imageInput.click(), {
  signal: events.signal,
});
node('clear-pdf').addEventListener(
  'click',
  () => {
    generation++;
    disposePages();
    pdfInput.value = '';
    node('pdf-name').textContent = 'PDF 页面';
    updateSelection();
    message('');
  },
  { signal: events.signal },
);
node('clear-images').addEventListener(
  'click',
  () => {
    for (const item of images) URL.revokeObjectURL(item.url);
    images.length = 0;
    renderImages();
    message('');
  },
  { signal: events.signal },
);
function bindDrop(id: string, receive: (files: File[]) => void) {
  const target = node(id);
  target.addEventListener(
    'dragover',
    (event) => {
      event.preventDefault();
      target.classList.add('drag-over');
    },
    { signal: events.signal },
  );
  target.addEventListener(
    'dragleave',
    () => target.classList.remove('drag-over'),
    { signal: events.signal },
  );
  target.addEventListener(
    'drop',
    (event) => {
      event.preventDefault();
      target.classList.remove('drag-over');
      const files = Array.from(event.dataTransfer?.files || []);
      if (files.length) receive(files);
    },
    { signal: events.signal },
  );
}
bindDrop('pdf-drop', (files) => {
  if (files[0]?.name.toLowerCase().endsWith('.pdf')) void loadPdf(files[0]);
  else message('请选择 PDF 文件');
});
bindDrop('image-drop', addImages);
function addImages(files: File[]) {
  for (const file of files)
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      images.push({ file, url: URL.createObjectURL(file) });
  renderImages();
}

function message(text: string) {
  status.textContent = text;
}
function disposePages() {
  preview.close();
  void documentPdf?.loadingTask.destroy().catch(() => {});
  documentPdf = undefined;
  for (const page of pages.values()) URL.revokeObjectURL(page.url);
  pages.clear();
  selected.clear();
  pagesNode.replaceChildren();
}
function renderPages() {
  pagesNode.replaceChildren();
  for (const page of pages.values()) {
    const card = document.createElement('div');
    card.className = 'pdf-page-card';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selected.has(page.page);
    checkbox.setAttribute('aria-label', `选择第 ${page.page} 页`);
    checkbox.addEventListener(
      'change',
      () => {
        checkbox.checked ? selected.add(page.page) : selected.delete(page.page);
        updateSelection();
      },
      { signal: events.signal },
    );
    const image = document.createElement('img');
    image.src = page.url;
    image.alt = `PDF 第 ${page.page} 页`;
    const caption = document.createElement('span');
    caption.textContent = `第 ${page.page} 页`;
    const open = document.createElement('button');
    open.className = 'pdf-preview-open';
    open.type = 'button';
    open.setAttribute('aria-label', `放大预览第 ${page.page} 页`);
    open.append(image, caption);
    open.addEventListener('click', () => void preview.show(page.page), {
      signal: events.signal,
    });
    card.append(checkbox, open);
    pagesNode.append(card);
  }
  updateSelection();
}
function updateSelection() {
  node('pdf-empty').hidden = pages.size > 0;
  (node('clear-pdf') as HTMLButtonElement).disabled = pages.size === 0;
  node('selection-count').textContent = pages.size
    ? `已选 ${selected.size} / ${pages.size} 页`
    : '未选择页面';
  selectAll.disabled = pages.size === 0;
  selectAll.checked = pages.size > 0 && selected.size === pages.size;
  selectAll.indeterminate = selected.size > 0 && selected.size < pages.size;
  downloadSelected.disabled = selected.size === 0 || exporting;
}
async function loadPdf(file: File) {
  const task = ++generation;
  disposePages();
  updateSelection();
  node('pdf-name').textContent = file.name;
  message('正在读取 PDF…');
  try {
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() })
      .promise;
    if (task !== generation) {
      await pdf.loadingTask.destroy();
      return;
    }
    documentPdf = pdf;
    for (let number = 1; number <= pdf.numPages; number++) {
      const blob = await renderPagePng(pdf, number, 72);
      if (task !== generation) return;
      pages.set(number, { page: number, blob, url: URL.createObjectURL(blob) });
      renderPages();
    }
    message(`已载入 ${pdf.numPages} 页，请选择需要保存的页面。`);
  } catch (error) {
    if (task === generation)
      message(
        error instanceof Error
          ? `PDF 处理失败：${error.message}`
          : 'PDF 处理失败',
      );
  }
}
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function renderImages() {
  imageList.replaceChildren();
  images.forEach((item, index) => {
    const row = document.createElement('li');
    row.draggable = true;
    row.dataset.index = String(index);
    const preview = document.createElement('img');
    preview.src = item.url;
    preview.alt = '';
    const name = document.createElement('span');
    name.textContent = item.file.name;
    const controls = document.createElement('span');
    controls.className = 'image-controls';
    for (const [label, delta] of [
      ['上移', -1],
      ['下移', 1],
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.disabled = index + delta < 0 || index + delta >= images.length;
      button.addEventListener('click', () => moveImage(index, index + delta), {
        signal: events.signal,
      });
      controls.append(button);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '移除';
    remove.addEventListener(
      'click',
      () => {
        URL.revokeObjectURL(item.url);
        images.splice(index, 1);
        renderImages();
      },
      { signal: events.signal },
    );
    controls.append(remove);
    row.addEventListener(
      'dragstart',
      (event) => {
        event.dataTransfer?.setData('text/plain', String(index));
      },
      { signal: events.signal },
    );
    row.addEventListener('dragover', (event) => event.preventDefault(), {
      signal: events.signal,
    });
    row.addEventListener(
      'drop',
      (event) => {
        event.preventDefault();
        const from = Number(event.dataTransfer?.getData('text/plain'));
        if (Number.isInteger(from)) moveImage(from, index);
      },
      { signal: events.signal },
    );
    row.append(preview, name, controls);
    imageList.append(row);
  });
  node('image-empty').hidden = images.length > 0;
  node('image-count').textContent = images.length
    ? `图片列表 · ${images.length} 张`
    : '图片列表';
  (node('clear-images') as HTMLButtonElement).disabled = images.length === 0;
  makePdf.disabled = images.length === 0;
}
function moveImage(from: number, to: number) {
  if (
    from < 0 ||
    to < 0 ||
    from >= images.length ||
    to >= images.length ||
    from === to
  )
    return;
  images.splice(to, 0, ...images.splice(from, 1));
  renderImages();
}

pdfInput.addEventListener(
  'change',
  () => {
    const file = pdfInput.files?.[0];
    if (file) void loadPdf(file);
  },
  { signal: events.signal },
);
selectAll.addEventListener(
  'change',
  () => {
    selected.clear();
    if (selectAll.checked) for (const page of pages.keys()) selected.add(page);
    renderPages();
  },
  { signal: events.signal },
);
async function exportSelected() {
  const pdf = documentPdf;
  if (!pdf || exporting) return;
  const task = generation;
  const numbers = Array.from(selected).sort((a, b) => a - b);
  exporting = true;
  updateSelection();
  try {
    const dpi = Number(
      root.querySelector<HTMLSelectElement>('#export-dpi')?.value,
    );
    if (![150, 300, 600].includes(dpi)) throw Error('请选择导出清晰度后重试');
    for (const [index, number] of numbers.entries()) {
      message(
        `正在导出 ${index + 1} / ${numbers.length} 张图片（${dpi} DPI）…`,
      );
      const blob = await renderPagePng(pdf, number, dpi);
      if (task !== generation) return;
      download(blob, `page-${number}-${dpi}dpi.png`);
    }
    message(`已导出 ${numbers.length} 张 ${dpi} DPI 图片。`);
  } catch (error) {
    if (task === generation)
      message(error instanceof Error ? error.message : '图片导出失败');
  } finally {
    exporting = false;
    updateSelection();
  }
}
downloadSelected.addEventListener('click', () => void exportSelected(), {
  signal: events.signal,
});
imageInput.addEventListener(
  'change',
  () => {
    addImages(Array.from(imageInput.files || []));
    imageInput.value = '';
    renderImages();
  },
  { signal: events.signal },
);
makePdf.addEventListener(
  'click',
  async () => {
    makePdf.disabled = true;
    message('正在生成 PDF…');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdf = await PDFDocument.create();
      for (const item of images) {
        const bytes = new Uint8Array(await item.file.arrayBuffer());
        const embedded =
          item.file.type === 'image/png'
            ? await pdf.embedPng(bytes)
            : await pdf.embedJpg(
                item.file.type === 'image/jpeg'
                  ? bytes
                  : await convertToJpeg(item.file),
              );
        const page = pdf.addPage([embedded.width, embedded.height]);
        page.drawImage(embedded, {
          x: 0,
          y: 0,
          width: page.getWidth(),
          height: page.getHeight(),
        });
      }
      const bytes = await pdf.save();
      download(
        new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
        'images.pdf',
      );
      message(`已将 ${images.length} 张图片合并为 PDF。`);
    } catch (error) {
      message(
        error instanceof Error ? `合并失败：${error.message}` : '图片合并失败',
      );
    } finally {
      makePdf.disabled = images.length === 0;
    }
  },
  { signal: events.signal },
);
async function convertToJpeg(file: File): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw Error('无法读取图片');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(Error('图片转换失败'))),
      'image/jpeg',
      0.92,
    ),
  );
  return new Uint8Array(await blob.arrayBuffer());
}
renderImages();
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    preview.dispose();
    disposeTabs();
    generation++;
    events.abort();
    disposePages();
    for (const image of images) URL.revokeObjectURL(image.url);
  });
import { mountOptionTabs } from '../shared/option-tabs';
