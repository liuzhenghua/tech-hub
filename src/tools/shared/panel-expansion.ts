import { setButtonLabel } from './button-label';

/** Expand the existing preview so diagrams and scroll state remain intact. */
export function mountPreviewExpansion(
  root: HTMLElement,
  selector = '#preview-expand',
  label = '全屏预览',
): () => void {
  const button = root.querySelector<HTMLButtonElement>(selector)!;
  const panel = button.closest<HTMLElement>('.editor')!;
  const events = new AbortController();
  const background: HTMLElement[] = [];
  for (let node: HTMLElement = panel; node !== root;) {
    const parent = node.parentElement!;
    for (const sibling of parent.children) {
      if (sibling !== node && sibling instanceof HTMLElement && !sibling.inert)
        background.push(sibling);
    }
    node = parent;
  }
  let expanded = false;
  function setExpanded(value: boolean) {
    expanded = value;
    panel.classList.toggle('preview-expanded', value);
    background.forEach((node) => {
      node.inert = value;
    });
    const text = value ? '退出全屏' : label;
    setButtonLabel(button, text);
    button.setAttribute('aria-pressed', String(value));
    if (!value) button.focus();
  }
  button.addEventListener('click', () => setExpanded(!expanded), {
    signal: events.signal,
  });
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && expanded) setExpanded(false);
    },
    { signal: events.signal },
  );
  return () => {
    panel.classList.remove('preview-expanded');
    background.forEach((node) => {
      node.inert = false;
    });
    events.abort();
  };
}
