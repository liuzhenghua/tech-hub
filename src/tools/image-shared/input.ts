import { formatBytes, validateImageFile, validateSize } from './model';
import { element, type ImageAsset } from './processing';
export function mountImageInput(
  root: HTMLElement,
  changed: (asset: ImageAsset | null) => void,
) {
  const events = new AbortController();
  const fileInput = element<HTMLInputElement>(root, 'file-input');
  const status = element(root, 'status');
  let generation = 0,
    asset: ImageAsset | null = null;
  function release() {
    if (!asset) return;
    asset.bitmap.close();
    URL.revokeObjectURL(asset.url);
    asset = null;
  }
  function show(next: ImageAsset | null) {
    element(root, 'empty').hidden = !!next;
    element(root, 'workspace').hidden = !next;
    if (!next) return;
    element(root, 'file-name').textContent = next.file.name;
    element(root, 'file-meta').textContent =
      `${next.bitmap.width} × ${next.bitmap.height} px · ${formatBytes(next.file.size)}`;
  }
  async function load(file?: File) {
    if (!file) return;
    const id = ++generation;
    status.textContent = '正在读取图片…';
    try {
      validateImageFile(file);
      const bitmap = await createImageBitmap(file);
      if (id !== generation) {
        bitmap.close();
        return;
      }
      try {
        validateSize(bitmap);
      } catch (error) {
        bitmap.close();
        throw error;
      }
      release();
      asset = { file, bitmap, url: URL.createObjectURL(file) };
      show(asset);
      status.textContent = '';
      changed(asset);
    } catch (error) {
      if (id === generation)
        status.textContent =
          error instanceof Error ? error.message : '图片读取失败，请重新选择。';
    } finally {
      if (id === generation) fileInput.value = '';
    }
  }
  function clear() {
    generation++;
    release();
    show(null);
    changed(null);
    status.textContent = '';
  }
  for (const id of ['choose-file', 'replace-file'])
    element(root, id).addEventListener('click', () => fileInput.click(), {
      signal: events.signal,
    });
  element(root, 'clear-file').addEventListener('click', clear, {
    signal: events.signal,
  });
  fileInput.addEventListener('change', () => void load(fileInput.files?.[0]), {
    signal: events.signal,
  });
  root.addEventListener(
    'dragover',
    (event) => {
      event.preventDefault();
      root.classList.add('dragging-file');
    },
    { signal: events.signal },
  );
  root.addEventListener(
    'dragleave',
    (event) => {
      if (!root.contains(event.relatedTarget as Node | null))
        root.classList.remove('dragging-file');
    },
    { signal: events.signal },
  );
  root.addEventListener(
    'drop',
    (event) => {
      event.preventDefault();
      root.classList.remove('dragging-file');
      void load(event.dataTransfer?.files[0]);
    },
    { signal: events.signal },
  );
  document.addEventListener(
    'paste',
    (event) => {
      const file = [...(event.clipboardData?.files || [])].find((item) =>
        item.type.startsWith('image/'),
      );
      if (file) {
        event.preventDefault();
        void load(file);
      }
    },
    { signal: events.signal },
  );
  return {
    get: () => asset,
    dispose() {
      generation++;
      events.abort();
      release();
    },
  };
}
