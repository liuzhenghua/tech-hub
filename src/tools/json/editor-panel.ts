import markup from './editor-panel.html?raw';
import { mountEditor } from '../shared/editor';
import { mountJSONControls } from './editor-controls';
import type { ToolDefinition } from '../shared/types';

export function mountEditorPanel(
  root: HTMLElement,
  tool: ToolDefinition,
): () => void {
  root.innerHTML = markup;
  const input = root.querySelector<HTMLTextAreaElement>('#input')!;
  root.querySelector('label[for="input"]')!.firstChild!.textContent =
    tool.id === 'json' ? 'JSON 原文 ' : '原文 ';
  input.placeholder =
    tool.id === 'json'
      ? '粘贴 JSON 后自动格式化，也可手动压缩或修复…'
      : '输入需要编解码或转义的文本…';
  const disposeEditor = mountEditor(root, tool);
  const disposeControls = mountJSONControls(root);
  return () => {
    disposeControls();
    disposeEditor();
  };
}
