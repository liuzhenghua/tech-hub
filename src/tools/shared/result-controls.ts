import { setButtonLabel } from './button-label';
import { mountPreviewExpansion } from './panel-expansion';

/** Result wrapping, fullscreen, and optional JSON tree controls. */
export function mountResultControls(root: HTMLElement): () => void {
  const events = new AbortController();
  const tree = root.querySelector<HTMLElement>('#json-tree')!;
  const output = root.querySelector<HTMLTextAreaElement>('#output')!;
  const toggle = root.querySelector<HTMLButtonElement>('#tree-expand-toggle')!;
  const wrap = root.querySelector<HTMLButtonElement>('#output-wrap')!;
  function updateExpansion() {
    const expanded =
      !!tree.querySelector('details') &&
      !tree.querySelector('details:not([open])');
    toggle.textContent = expanded ? '全部折叠' : '全部展开';
    toggle.setAttribute('aria-expanded', String(expanded));
  }
  toggle.addEventListener(
    'click',
    () => {
      const expanded = toggle.getAttribute('aria-expanded') !== 'true';
      // Opening a lazy group builds its children before visiting the next level.
      function visit(parent: HTMLElement) {
        for (const group of parent.querySelectorAll<HTMLDetailsElement>(
          ':scope > details',
        )) {
          group.open = expanded;
          group.dispatchEvent(new Event('toggle'));
          visit(group.querySelector<HTMLElement>('.json-children')!);
        }
      }
      visit(tree);
      updateExpansion();
    },
    { signal: events.signal },
  );
  tree.addEventListener('toggle', updateExpansion, {
    capture: true,
    signal: events.signal,
  });
  const observer = new MutationObserver(updateExpansion);
  observer.observe(tree, { childList: true, subtree: true });
  wrap.addEventListener(
    'click',
    () => {
      const enabled = wrap.getAttribute('aria-pressed') !== 'true';
      wrap.setAttribute('aria-pressed', String(enabled));
      setButtonLabel(wrap, '自动换行：' + (enabled ? '开' : '关'));
      output.wrap = enabled ? 'soft' : 'off';
      tree.classList.toggle('no-wrap', !enabled);
    },
    { signal: events.signal },
  );
  const disposers = ['input', 'output'].map((id) => {
    return mountPreviewExpansion(root, '#' + id + '-fullscreen', '全屏');
  });
  updateExpansion();
  return () => {
    events.abort();
    observer.disconnect();
    disposers.forEach((dispose) => dispose());
  };
}
