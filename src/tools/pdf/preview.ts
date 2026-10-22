import type { PDFDocumentProxy } from 'pdfjs-dist';
import { renderPagePng } from './render';

export function mountPagePreview(options: {
  document: () => PDFDocumentProxy | undefined;
  selected: (page: number) => boolean;
  select: (page: number, value: boolean) => void;
}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'pdf-preview';
  dialog.setAttribute('aria-label', 'PDF 页面放大预览');
  dialog.innerHTML = `<div class="pdf-preview-toolbar">
    <button data-action="previous" aria-label="上一页">←</button>
    <span class="pdf-preview-page"></span>
    <button data-action="next" aria-label="下一页">→</button>
    <label><input type="checkbox" /> 选择此页导出</label>
    <label>缩放 <select aria-label="预览缩放"><option value="100">适合宽度</option><option value="150">150%</option><option value="200">200%</option></select></label>
    <button data-action="close" autofocus>关闭 · Esc</button>
    </div><p role="status" aria-live="polite"></p><div class="pdf-preview-scroll"><img alt="" hidden /></div>`;
  document.body.append(dialog);
  const image = dialog.querySelector('img')!;
  const checkbox = dialog.querySelector('input')!;
  const zoom = dialog.querySelector('select')!;
  const status = dialog.querySelector('p')!;
  const events = new AbortController();
  let page = 1;
  let revision = 0;
  let url = '';
  function release() {
    revision++;
    URL.revokeObjectURL(url);
    url = '';
    image.removeAttribute('src');
  }
  function close() {
    release();
    dialog.close();
  }
  async function show(number: number) {
    const pdf = options.document();
    if (!pdf || number < 1 || number > pdf.numPages) return;
    const task = ++revision;
    page = number;
    checkbox.checked = options.selected(page);
    dialog.querySelector('.pdf-preview-page')!.textContent =
      `第 ${page} / ${pdf.numPages} 页`;
    dialog.querySelector<HTMLButtonElement>(
      '[data-action="previous"]',
    )!.disabled = page === 1;
    dialog.querySelector<HTMLButtonElement>('[data-action="next"]')!.disabled =
      page === pdf.numPages;
    image.hidden = true;
    status.textContent = '正在生成高清预览…';
    if (!dialog.open) dialog.showModal();
    try {
      const blob = await renderPagePng(pdf, page, 150);
      if (task !== revision || !dialog.open) return;
      URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      image.src = url;
      image.alt = `PDF 第 ${page} 页`;
      image.hidden = false;
      status.textContent = '';
      dialog.querySelector('.pdf-preview-scroll')!.scrollTo(0, 0);
    } catch (error) {
      if (task === revision)
        status.textContent =
          error instanceof Error ? error.message : '预览失败';
    }
  }
  dialog.addEventListener(
    'click',
    (event) => {
      const action = (event.target as HTMLElement).closest<HTMLButtonElement>(
        'button',
      )?.dataset.action;
      if (action === 'close') close();
      if (action === 'previous') void show(page - 1);
      if (action === 'next') void show(page + 1);
    },
    { signal: events.signal },
  );
  dialog.addEventListener('close', release, { signal: events.signal });
  checkbox.addEventListener(
    'change',
    () => options.select(page, checkbox.checked),
    { signal: events.signal },
  );
  zoom.addEventListener(
    'change',
    () => {
      image.style.width = `${zoom.value}%`;
    },
    { signal: events.signal },
  );
  return {
    show,
    close,
    dispose: () => {
      close();
      events.abort();
      dialog.remove();
    },
  };
}
