import { mountEditor } from '../shared/editor';
import { mountJSONControls } from './editor-controls';
import { tool as jsonTool } from './tool';
import { tool as stringsTool } from '../strings/tool';

let activeRoot = document.querySelector<HTMLElement>('main')!;
const template = activeRoot.cloneNode(true) as HTMLElement;
const events = new AbortController();
const panels = new Map<string, HTMLElement>();
const disposers: (() => void)[] = [];

function createPanel(mode: string): HTMLElement {
  const root = template.cloneNode(true) as HTMLElement;
  const tool = mode === 'json' ? jsonTool : stringsTool;
  const input = root.querySelector<HTMLTextAreaElement>('#input')!;
  root.querySelector('label[for="input"]')!.firstChild!.textContent =
    mode === 'json' ? 'JSON 原文 ' : '原文 ';
  input.placeholder =
    mode === 'json'
      ? '粘贴 JSON 后自动格式化，也可手动压缩或修复…'
      : '输入需要编解码或转义的文本…';
  for (const button of root.querySelectorAll<HTMLElement>('[data-mode]')) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    button.addEventListener(
      'click',
      () => {
        location.hash = button.dataset.mode!;
      },
      { signal: events.signal },
    );
  }
  activeRoot.replaceWith(root);
  activeRoot = root;
  // Each tool owns its DOM and editor lifecycle, including unsaved view state.
  disposers.push(mountEditor(root, tool), mountJSONControls(root));
  panels.set(mode, root);
  return root;
}

function switchTool() {
  const mode = location.hash === '#strings' ? 'strings' : 'json';
  const root = panels.get(mode) ?? createPanel(mode);
  if (root !== activeRoot) activeRoot.replaceWith(root);
  activeRoot = root;
  document.body.dataset.tool = mode;
  document.title =
    (mode === 'json' ? jsonTool.title : stringsTool.title) +
    ' · ' +
    (import.meta.env.VITE_SITE_TITLE || '文档与工具');
}

window.addEventListener('hashchange', switchTool, { signal: events.signal });
switchTool();
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    events.abort();
    disposers.forEach((dispose) => dispose());
  });
