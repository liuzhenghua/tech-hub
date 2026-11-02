import { element } from './ui';
export function mountDiffLayout(root: HTMLElement): () => void {
  const button = element<HTMLButtonElement>(root, 'diff-fullscreen');
  const result = element(root, 'diff-result');
  const headings = root.querySelector<HTMLElement>('.utility-diff-headings')!;
  const events = new AbortController();
  let expanded = false;
  const icon = (exit: boolean) =>
    exit
      ? '<path d="M8 3v5H3m18 0h-5V3M3 16h5v5m8 0v-5h5"/>'
      : '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>';
  function setExpanded(value: boolean) {
    expanded = value;
    root.classList.toggle('utility-diff-fullscreen', value);
    button.setAttribute('aria-pressed', String(value));
    button.setAttribute('aria-label', value ? '退出全屏' : '全屏');
    button.title = value ? '退出全屏（Esc）' : '全屏';
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icon(value)}</svg>`;
  }
  function alignHeadings() {
    headings.style.paddingRight = `${result.hidden ? 0 : result.offsetWidth - result.clientWidth}px`;
  }
  const observer = new ResizeObserver(alignHeadings);
  observer.observe(result);
  button.addEventListener('click', () => setExpanded(!expanded), {
    signal: events.signal,
  });
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && expanded) {
        setExpanded(false);
        button.focus();
      }
    },
    { signal: events.signal },
  );
  setExpanded(false);
  return () => {
    observer.disconnect();
    events.abort();
    root.classList.remove('utility-diff-fullscreen');
  };
}
