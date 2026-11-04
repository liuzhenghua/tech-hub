import { recordUsage } from '../../tool-usage';
import { mountImageInput } from '../image-shared/input';
import {
  element,
  encodeImage,
  downloadImage,
  type ImageAsset,
} from '../image-shared/processing';
import {
  outputName,
  formatBytes,
  type Crop,
  type ImageFormat,
} from '../image-shared/model';
import { boundedCrop, centeredCrop, editCrop, pixelCrop } from './geometry';
import { mountSelection } from './selection';
recordUsage('image-crop', true);
const root = document.querySelector<HTMLElement>('main')!;
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  element<T>(root, id);
const events = new AbortController();
const format = $<HTMLSelectElement>('output-format');
const quality = $<HTMLInputElement>('crop-quality');
const download = $<HTMLButtonElement>('download-crop');
let crop: Crop | null = null,
  ratio = 0,
  generation = 0;
const input = mountImageInput(root, receive);
const disposeSelection = mountSelection(
  $('crop-stage'),
  $('crop-selection'),
  () => {
    const asset = input.get();
    return asset && crop ? { crop, bounds: asset.bitmap, ratio } : null;
  },
  update,
);
function receive(asset: ImageAsset | null) {
  generation++;
  $('source-image').removeAttribute('src');
  if (!asset) {
    crop = null;
    return;
  }
  $<HTMLImageElement>('source-image').src = asset.url;
  ratio = 0;
  updateRatios('0');
  update(centeredCrop(asset.bitmap));
}
function updateRatios(value: string) {
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-ratio]'))
    button.setAttribute('aria-pressed', String(button.dataset.ratio === value));
}
function preview(asset: ImageAsset, selected: Crop) {
  const canvas = $<HTMLCanvasElement>('crop-preview');
  const scale = Math.min(1, 264 / selected.width, 140 / selected.height);
  canvas.width = Math.max(1, Math.round(selected.width * scale));
  canvas.height = Math.max(1, Math.round(selected.height * scale));
  canvas
    .getContext('2d')
    ?.drawImage(
      asset.bitmap,
      selected.x,
      selected.y,
      selected.width,
      selected.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
}
function update(next: Crop) {
  const asset = input.get();
  if (!asset) return;
  crop = boundedCrop(next, asset.bitmap);
  generation++;
  const selected = pixelCrop(crop, asset.bitmap);
  const node = $('crop-selection');
  node.style.left = `${(crop.x / asset.bitmap.width) * 100}%`;
  node.style.top = `${(crop.y / asset.bitmap.height) * 100}%`;
  node.style.width = `${(crop.width / asset.bitmap.width) * 100}%`;
  node.style.height = `${(crop.height / asset.bitmap.height) * 100}%`;
  for (const key of ['x', 'y', 'width', 'height'] as const)
    $<HTMLInputElement>(`crop-${key}`).value = String(selected[key]);
  $('selection-size').textContent = `${selected.width} × ${selected.height}`;
  $('crop-output-size').textContent =
    `导出 ${selected.width} × ${selected.height} px`;
  preview(asset, selected);
  download.disabled = false;
  download.textContent = '下载裁剪图片';
  $('status').textContent = '';
}
root.querySelectorAll<HTMLButtonElement>('[data-ratio]').forEach((button) =>
  button.addEventListener(
    'click',
    () => {
      const asset = input.get();
      if (!asset) return;
      const value = Number(button.dataset.ratio);
      ratio = value < 0 ? asset.bitmap.width / asset.bitmap.height : value;
      updateRatios(String(value));
      update(centeredCrop(asset.bitmap, ratio));
    },
    { signal: events.signal },
  ),
);
function editCoordinate(key: keyof Crop) {
  const asset = input.get(),
    value = $<HTMLInputElement>(`crop-${key}`).valueAsNumber;
  if (!asset || !crop) return;
  if (
    !Number.isInteger(value) ||
    value < (key === 'x' || key === 'y' ? 0 : 1)
  ) {
    update(crop);
    $('status').textContent = '坐标须为非负整数，宽高须为正整数。';
    return;
  }
  update(editCrop(crop, key, value, asset.bitmap, ratio));
}
for (const key of ['x', 'y', 'width', 'height'] as const)
  $(`crop-${key}`).addEventListener('change', () => editCoordinate(key), {
    signal: events.signal,
  });
$('reset-crop').addEventListener(
  'click',
  () => {
    const asset = input.get();
    if (asset) update(centeredCrop(asset.bitmap, ratio));
  },
  { signal: events.signal },
);
function exportSettings() {
  generation++;
  download.disabled = !input.get();
  download.textContent = '下载裁剪图片';
  $('crop-quality-control').hidden = format.value === 'image/png';
  $('crop-export-note').textContent =
    format.value === 'image/jpeg'
      ? '导出移除图片元数据；透明区域填充为白色。'
      : '导出移除图片元数据，并保留透明背景。';
}
format.addEventListener('change', exportSettings, { signal: events.signal });
quality.addEventListener(
  'input',
  () => {
    $('crop-quality-value').textContent = quality.value;
    exportSettings();
  },
  { signal: events.signal },
);
async function save() {
  const asset = input.get();
  if (!asset || !crop) return;
  const id = ++generation,
    selected = pixelCrop(crop, asset.bitmap),
    type = format.value as ImageFormat;
  download.disabled = true;
  download.textContent = '正在导出…';
  try {
    const blob = await encodeImage(
      asset.bitmap,
      selected,
      selected,
      type,
      Number(quality.value) / 100,
    );
    if (id !== generation) return;
    downloadImage(blob, outputName(asset.file.name, 'cropped', type));
    $('status').textContent =
      `已导出 ${selected.width} × ${selected.height} px · ${formatBytes(blob.size)}`;
  } catch (error) {
    if (id === generation)
      $('status').textContent =
        error instanceof Error ? error.message : '导出失败，请重试。';
  } finally {
    if (id === generation) {
      download.disabled = false;
      download.textContent = '下载裁剪图片';
    }
  }
}
download.addEventListener('click', () => void save(), {
  signal: events.signal,
});
function dispose() {
  generation++;
  events.abort();
  disposeSelection();
  input.dispose();
}
window.addEventListener(
  'pagehide',
  (event) => {
    if (!event.persisted) dispose();
  },
  { signal: events.signal },
);
if (import.meta.hot) import.meta.hot.dispose(dispose);
