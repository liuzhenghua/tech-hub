export interface WorkspaceTool {
  title: string;
  mount: (root: HTMLElement) => () => void;
}

export function mountToolWorkspace(
  root: HTMLElement,
  tools: Record<string, WorkspaceTool>,
  defaultMode: string,
  redirects: Record<string, string> = {},
): () => void {
  const host = root.querySelector<HTMLElement>('#tool-workspace')!;
  const events = new AbortController();
  const panels = new Map<string, HTMLElement>();
  const disposers: (() => void)[] = [];
  function createPanel(mode: string) {
    const panel = document.createElement('section');
    panel.className = 'tool-workspace-panel';
    host.replaceChildren(panel);
    const dispose = tools[mode].mount(panel);
    panels.set(mode, panel);
    disposers.push(dispose);
    return panel;
  }
  function switchTool() {
    const hash = location.hash.slice(1);
    if (Object.hasOwn(redirects, hash)) {
      location.replace(redirects[hash]);
      return;
    }
    const mode = Object.hasOwn(tools, hash) ? hash : defaultMode;
    const panel = panels.get(mode) ?? createPanel(mode);
    host.replaceChildren(panel);
    for (const button of root.querySelectorAll<HTMLElement>('[data-mode]'))
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    document.body.dataset.tool = mode;
    document.title =
      tools[mode].title +
      ' · ' +
      (import.meta.env.VITE_SITE_TITLE || '文档与工具');
  }
  for (const button of root.querySelectorAll<HTMLElement>('[data-mode]'))
    button.addEventListener(
      'click',
      () => {
        location.hash = button.dataset.mode!;
      },
      { signal: events.signal },
    );
  window.addEventListener('hashchange', switchTool, { signal: events.signal });
  switchTool();
  return () => {
    events.abort();
    disposers.forEach((dispose) => dispose());
    host.replaceChildren();
  };
}
