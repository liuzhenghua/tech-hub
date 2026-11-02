import markup from './regex-syntax.html?raw';
import { element } from './ui';
export function mountRegexSyntax(root: HTMLElement): () => void {
  const template = document.createElement('template');
  template.innerHTML = markup;
  const dialog = template.content.firstElementChild as HTMLDialogElement;
  root.append(dialog);
  const events = new AbortController();
  element(root, 'regex-syntax-open').addEventListener(
    'click',
    () => dialog.showModal(),
    { signal: events.signal },
  );
  dialog.addEventListener(
    'click',
    (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      )
        dialog.close();
    },
    { signal: events.signal },
  );
  return () => {
    dialog.close();
    events.abort();
    dialog.remove();
  };
}
