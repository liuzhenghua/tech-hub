import { createCopyFeedback } from '../../copy-feedback';
import { icon } from '../shared/icons';
export function decorateCopyButtons(root: HTMLElement): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>(
    '[data-copy]',
  )) {
    const label = button.textContent!.trim();
    button.classList.add('editor-icon');
    button.setAttribute('aria-label', label);
    button.title = label;
    button.replaceChildren(icon('copy'));
  }
  updateCopyButtons(root);
}
export function updateCopyButtons(root: HTMLElement): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>(
    '[data-copy]',
  )) {
    button.disabled = !element<HTMLInputElement | HTMLTextAreaElement>(
      root,
      button.dataset.copy!,
    ).value;
  }
}
export function element<T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  id: string,
): T {
  return root.querySelector<T>('#' + id)!;
}
export function copyActions(status: HTMLElement) {
  const feedback = createCopyFeedback();
  let disposed = false;
  return {
    async copy(button: HTMLButtonElement, value: string) {
      try {
        await navigator.clipboard.writeText(value);
        if (!disposed && button.isConnected) feedback.show(button);
      } catch {
        if (!disposed) status.textContent = '复制失败，请手动选中内容复制。';
      }
    },
    dispose() {
      disposed = true;
      feedback.dispose();
    },
  };
}
export function reactiveInputs(
  root: HTMLElement,
  run: () => void,
  cancel: () => void,
): () => void {
  const events = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  function schedule() {
    cancel();
    clearTimeout(timer);
    timer = setTimeout(run, 180);
  }
  root.addEventListener('input', schedule, { signal: events.signal });
  root.addEventListener('change', schedule, { signal: events.signal });
  return () => {
    events.abort();
    clearTimeout(timer);
    cancel();
  };
}
