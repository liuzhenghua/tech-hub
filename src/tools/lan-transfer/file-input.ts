import { parseControl } from './protocol';

export function mountFileInput(
  root: HTMLElement,
  locked: () => boolean,
  changed: () => void,
  status: (text: string) => void,
) {
  const events = new AbortController();
  const input = root.querySelector<HTMLInputElement>('#file')!;
  const zone = root.querySelector<HTMLElement>('#drop-zone')!;
  const label = root.querySelector<HTMLElement>('#selected-file')!;
  const choose = root.querySelector<HTMLButtonElement>('#choose-file')!;
  const clearButton = root.querySelector<HTMLButtonElement>('#clear-file')!;
  let selected: File | undefined;
  function clear() {
    selected = undefined;
    input.value = '';
    label.textContent = '尚未选择文件';
    clearButton.disabled = true;
    changed();
  }
  function select(files: FileList | File[]) {
    if (!files.length) return;
    if (locked()) {
      status('正在传输，请完成当前任务后再添加文件。');
      return;
    }
    if (files.length > 1) {
      status('每次发送一个文件，请只添加一个文件。');
      return;
    }
    const file = files[0];
    try {
      parseControl(
        JSON.stringify({ type: 'file', name: file.name, size: file.size }),
      );
      selected = file;
      label.textContent = `${file.name} · ${file.size.toLocaleString()} 字节`;
      clearButton.disabled = false;
      status('文件已就绪，连接后点击发送。');
      changed();
    } catch (error) {
      status(error instanceof Error ? error.message : '无法添加文件。');
    }
  }
  choose.addEventListener('click', () => input.click(), {
    signal: events.signal,
  });
  input.addEventListener(
    'change',
    () => {
      select(input.files || []);
      input.value = '';
    },
    { signal: events.signal },
  );
  clearButton.addEventListener(
    'click',
    () => {
      if (!locked()) clear();
    },
    { signal: events.signal },
  );
  root.addEventListener(
    'dragover',
    (event) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      if (!locked()) zone.classList.add('dragging-file');
    },
    { signal: events.signal },
  );
  root.addEventListener(
    'dragleave',
    (event) => {
      if (!root.contains(event.relatedTarget as Node | null))
        zone.classList.remove('dragging-file');
    },
    { signal: events.signal },
  );
  root.addEventListener(
    'drop',
    (event) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      zone.classList.remove('dragging-file');
      const directory = [...event.dataTransfer.items].some(
        (item) => item.webkitGetAsEntry?.()?.isDirectory,
      );
      if (directory) {
        status('暂不支持文件夹，请选择单个文件。');
        return;
      }
      select(event.dataTransfer.files);
    },
    { signal: events.signal },
  );
  document.addEventListener(
    'paste',
    (event) => {
      if (!event.clipboardData?.files.length) return;
      event.preventDefault();
      select(event.clipboardData.files);
    },
    { signal: events.signal },
  );
  return {
    get: () => selected,
    update() {
      input.disabled = choose.disabled = locked();
      clearButton.disabled = locked() || !selected;
      zone.setAttribute('aria-disabled', String(locked()));
      if (locked()) zone.classList.remove('dragging-file');
    },
    dispose() {
      events.abort();
      selected = undefined;
      zone.classList.remove('dragging-file');
    },
  };
}
