import { mountComparison } from './comparison';
import { recordUsage } from '../../tool-usage';
import { mountImageInput } from '../image-shared/input';
import {
  element,
  encodeImage,
  downloadImage,
  type ImageAsset,
} from '../image-shared/processing';
import {
  fitSize,
  formatBytes,
  outputName,
  reduction,
  type Size,
  type ImageFormat,
} from '../image-shared/model';
recordUsage('image-compress', true);
const root = document.querySelector<HTMLElement>('main')!;
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  element<T>(root, id);
const events = new AbortController();
const quality = $<HTMLInputElement>('quality'),
  edge = $<HTMLInputElement>('max-edge');
const format = $<HTMLSelectElement>('output-format');
const download = $<HTMLButtonElement>('download-compressed');
let generation = 0,
  timer: ReturnType<typeof setTimeout> | undefined;
let result: {
  blob: Blob;
  url: string;
  size: Size;
  format: ImageFormat;
} | null = null;
const input = mountImageInput(root, receive);
const comparison = mountComparison(
  root,
  () => result?.size || input.get()?.bitmap || null,
);
function clearResult() {
  $('result-image').removeAttribute('src');
  $('result-image').hidden = true;
  if (result) URL.revokeObjectURL(result.url);
  result = null;
}
function cancel() {
  generation++;
  clearTimeout(timer);
  download.disabled = true;
}
function receive(asset: ImageAsset | null) {
  cancel();
  clearResult();
  $('original-image').removeAttribute('src');
  if (!asset) return;
  $<HTMLImageElement>('original-image').src = asset.url;
  edge.value = String(Math.max(asset.bitmap.width, asset.bitmap.height));
  edge.max = edge.value;
  $('original-size').textContent = formatBytes(asset.file.size);
  $('result-size').textContent = '—';
  $('saving-value').textContent = '计算中…';
  $('result-dimensions').textContent = '';
  $('larger-note').hidden = true;
  comparison.update();
  schedule();
}
function updateSettings() {
  $('quality-value').textContent = quality.value;
  for (const button of root.querySelectorAll<HTMLButtonElement>(
    '[data-quality]',
  ))
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.quality === quality.value),
    );
  $('format-note').textContent =
    format.value === 'image/jpeg'
      ? '兼容性好；透明区域填充为白色。'
      : '支持透明背景，适合网页图片与截图。';
  download.textContent =
    format.value === 'image/jpeg' ? '下载 JPEG' : '下载 WebP';
}
function schedule() {
  cancel();
  updateSettings();
  if (!input.get()) return;
  $('encoding-note').hidden = false;
  $('encoding-note').textContent = '正在生成预览…';
  $('status').textContent = '';
  const id = generation;
  timer = setTimeout(() => void process(id), 220);
}
function showResult(
  blob: Blob,
  url: string,
  size: Size,
  type: ImageFormat,
  asset: ImageAsset,
) {
  clearResult();
  result = { blob, url, size, format: type };
  $<HTMLImageElement>('result-image').src = url;
  $('result-image').hidden = false;
  const saved = reduction(asset.file.size, blob.size);
  $('saving-value').textContent =
    saved >= 0
      ? `节省 ${saved.toFixed(1)}%`
      : `增加 ${Math.abs(saved).toFixed(1)}%`;
  $('result-size').textContent = formatBytes(blob.size);
  $('result-dimensions').textContent =
    `输出 ${size.width} × ${size.height} px · ${type === 'image/webp' ? 'WebP' : 'JPEG'}`;
  $('larger-note').hidden = blob.size <= asset.file.size;
  $('encoding-note').hidden = true;
  download.disabled = false;
  comparison.update();
}
async function process(id: number) {
  const asset = input.get();
  if (!asset || id !== generation) return;
  let url: string | undefined;
  try {
    if (!Number.isInteger(edge.valueAsNumber))
      throw Error('最长边必须是正整数。');
    const size = fitSize(asset.bitmap, edge.valueAsNumber),
      type = format.value as ImageFormat;
    const blob = await encodeImage(
      asset.bitmap,
      { x: 0, y: 0, width: asset.bitmap.width, height: asset.bitmap.height },
      size,
      type,
      Number(quality.value) / 100,
    );
    if (id !== generation) return;
    url = URL.createObjectURL(blob);
    const image = new Image();
    image.src = url;
    await image.decode();
    if (id !== generation) {
      URL.revokeObjectURL(url);
      return;
    }
    showResult(blob, url, size, type, asset);
  } catch (error) {
    if (url) URL.revokeObjectURL(url);
    if (id === generation) {
      $('status').textContent =
        error instanceof Error ? error.message : '压缩失败，请重试。';
      $('encoding-note').textContent = '预览生成失败，请调整参数或重新生成。';
    }
  }
}
quality.addEventListener('input', schedule, { signal: events.signal });
edge.addEventListener('input', schedule, { signal: events.signal });
format.addEventListener('change', schedule, { signal: events.signal });
$('retry-compress').addEventListener('click', schedule, {
  signal: events.signal,
});
for (const button of root.querySelectorAll<HTMLButtonElement>('[data-quality]'))
  button.addEventListener(
    'click',
    () => {
      quality.value = button.dataset.quality!;
      schedule();
    },
    { signal: events.signal },
  );
for (const button of root.querySelectorAll<HTMLButtonElement>('[data-edge]'))
  button.addEventListener(
    'click',
    () => {
      const asset = input.get();
      if (!asset) return;
      edge.value = String(
        Math.min(
          Number(button.dataset.edge) || Infinity,
          Math.max(asset.bitmap.width, asset.bitmap.height),
        ),
      );
      schedule();
    },
    { signal: events.signal },
  );
download.addEventListener(
  'click',
  () => {
    const asset = input.get();
    if (!result || !asset || download.disabled) return;
    downloadImage(
      result.blob,
      outputName(asset.file.name, 'compressed', result.format),
    );
    $('status').textContent =
      `已下载 ${formatBytes(result.blob.size)} 的${result.format === 'image/webp' ? ' WebP' : ' JPEG'} 图片。`;
  },
  { signal: events.signal },
);
function dispose() {
  cancel();
  events.abort();
  clearResult();
  input.dispose();
  comparison.dispose();
}
window.addEventListener(
  'pagehide',
  (event) => {
    if (!event.persisted) dispose();
  },
  { signal: events.signal },
);
if (import.meta.hot) import.meta.hot.dispose(dispose);
