import type { ClipboardEntry } from './model';
import { icon } from './icons';

export function mountClipboardDetails(root: HTMLElement) {
  const dialog = root.querySelector<HTMLDialogElement>('#clipboard-detail')!;
  const text = root.querySelector<HTMLTextAreaElement>(
    '#clipboard-detail-text',
  )!;
  const close = root.querySelector<HTMLButtonElement>(
    '#clipboard-detail-close',
  )!;
  const events = new AbortController();
  let current: ClipboardEntry | undefined;
  let changed: (() => void) | undefined;
  close.prepend(icon('close'));
  close.addEventListener('click', () => dialog.close(), {
    signal: events.signal,
  });
  dialog.addEventListener(
    'close',
    () => {
      current = undefined;
      changed = undefined;
    },
    { signal: events.signal },
  );
  text.addEventListener(
    'input',
    () => {
      if (!current) return;
      current.text = text.value;
      changed?.();
    },
    { signal: events.signal },
  );
  return {
    show(entry: ClipboardEntry, onChange: () => void) {
      current = entry;
      changed = onChange;
      text.value = entry.text;
      dialog.showModal();
    },
    dispose() {
      dialog.close();
      events.abort();
    },
  };
}
