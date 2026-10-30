import markup from './editor-panel.html?raw';
import { mountEditor } from './editor';
import { mountResultControls } from './result-controls';
import type { ToolDefinition } from './types';

export function mountEditorPanel(
  root: HTMLElement,
  tool: ToolDefinition,
): () => void {
  root.innerHTML = markup;
  const input = root.querySelector<HTMLTextAreaElement>('#input')!;
  root.querySelector('label[for="input"]')!.firstChild!.textContent =
    (tool.inputLabel || '原文') + ' ';
  input.placeholder = tool.inputPlaceholder || '输入需要处理的文本…';
  root.querySelector<HTMLTextAreaElement>('#output')!.placeholder =
    tool.outputPlaceholder || '处理结果会显示在这里';
  const disposeEditor = mountEditor(root, tool);
  const disposeControls = mountResultControls(root);
  return () => {
    disposeControls();
    disposeEditor();
  };
}
