import { mountEditorPanel } from './json/editor-panel';
import { tool as jsonTool } from './json/tool';
import { tool as stringsTool } from './strings/tool';
import { mountClipboard } from './clipboard/panel';
import './clipboard/style.css';

type Mode = 'json' | 'strings' | 'clipboard';
const titles = {
  json: 'JSON 工具',
  strings: '字符串处理',
  clipboard: '剪贴板',
};

export function mountWorkspace(root: HTMLElement): () => void {
  const host = root.querySelector<HTMLElement>('#tool-workspace')!;
  const events = new AbortController();
  const panels = new Map<Mode, HTMLElement>();
  const disposers: (() => void)[] = [];
  function createPanel(mode: Mode) {
    const panel = document.createElement('section');
    panel.className = 'tool-workspace-panel';
    host.replaceChildren(panel);
    const dispose =
      mode === 'clipboard'
        ? mountClipboard(panel)
        : mountEditorPanel(panel, mode === 'json' ? jsonTool : stringsTool);
    panels.set(mode, panel);
    disposers.push(dispose);
    return panel;
  }
  function switchTool() {
    const hash = location.hash.slice(1);
    const mode: Mode =
      hash === 'strings' || hash === 'clipboard' ? hash : 'json';
    const panel = panels.get(mode) ?? createPanel(mode);
    host.replaceChildren(panel);
    for (const button of root.querySelectorAll<HTMLElement>('[data-mode]'))
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    document.body.dataset.tool = mode;
    document.title =
      titles[mode] + ' · ' + (import.meta.env.VITE_SITE_TITLE || '文档与工具');
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
