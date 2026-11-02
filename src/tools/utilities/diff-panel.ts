import markup from './diff-panel.html?raw';
import type { DiffLine } from './diff';
import { renderDiff } from './diff-render';
import { createAnalysisTask } from './task';
import {
  element,
  copyActions,
  reactiveInputs,
  decorateCopyButtons,
  updateCopyButtons,
} from './ui';
import { mountOptionTabs } from '../shared/option-tabs';
import { readDiffDraft, writeDiffDraft } from './diff-storage';
import { mountDiffLayout } from './diff-layout';
export function mountDiff(root: HTMLElement): () => void {
  root.innerHTML = markup;
  decorateCopyButtons(root);
  const disposeLayout = mountDiffLayout(root);
  const disposeTabs = ['diff-mode', 'diff-view'].map((id) =>
    mountOptionTabs(element<HTMLSelectElement>(root, id)),
  );
  const status = element(root, 'utility-status');
  const copies = copyActions(status);
  const events = new AbortController();
  const result = element(root, 'diff-result');
  const left = element<HTMLTextAreaElement>(root, 'diff-left');
  const right = element<HTMLTextAreaElement>(root, 'diff-right');
  const edit = element<HTMLButtonElement>(root, 'diff-edit');
  const inputs = element(root, 'diff-inputs');
  let editing = true;
  function setEditing(value: boolean) {
    editing = value;
    inputs.hidden = !value;
    result.hidden = value;
    edit.textContent = value ? '查看差异' : '编辑内容';
  }
  edit.addEventListener(
    'click',
    () => {
      setEditing(!editing);
      if (!editing) run();
      else left.focus();
    },
    { signal: events.signal },
  );
  const selected = (id: string) => element<HTMLSelectElement>(root, id).value;
  const checked = (id: string) => element<HTMLInputElement>(root, id).checked;
  function saveDraft() {
    const saved = writeDiffDraft({
      left: left.value,
      right: right.value,
      mode: selected('diff-mode') === 'json' ? 'json' : 'text',
      view: selected('diff-view') === 'unified' ? 'unified' : 'split',
      wrap: checked('diff-wrap'),
      hideSame: checked('diff-hide'),
    });
    if (!saved) status.textContent = '本地保存失败，请复制重要内容。';
  }
  function updateWrap() {
    const wrap = checked('diff-wrap');
    left.wrap = right.wrap = wrap ? 'soft' : 'off';
    inputs.classList.toggle('diff-no-wrap', !wrap);
    result.classList.toggle('diff-no-wrap', !wrap);
  }
  element(root, 'diff-wrap').addEventListener('change', updateWrap, {
    signal: events.signal,
  });
  updateWrap();
  const task = createAnalysisTask<DiffLine[]>(
    (lines) => {
      if (!root.isConnected) return;
      const added = lines.filter((line) => line.kind === 'add').length;
      const removed = lines.filter((line) => line.kind === 'remove').length;
      element(root, 'diff-summary').textContent =
        `+ ${added} 行新增 · − ${removed} 行删除`;
      status.textContent = added || removed ? '对比完成' : '内容相同';
      renderDiff(
        result,
        lines,
        selected('diff-view') === 'unified',
        checked('diff-hide'),
        checked('diff-wrap'),
      );
      result.removeAttribute('aria-busy');
    },
    (message) => {
      status.textContent = message;
      result.removeAttribute('aria-busy');
    },
  );
  function clearResult() {
    updateWrap();
    updateCopyButtons(root);
    task.cancel();
    result.replaceChildren();
    result.dataset.emptyMessage = '在上方输入内容，差异会显示在这里';
    result.removeAttribute('aria-busy');
    element(root, 'diff-summary').textContent = '';
    status.textContent = '等待对比…';
  }
  function run() {
    if (left.value.length + right.value.length > 1_000_000) {
      status.textContent = '输入过大，请将总长度控制在 100 万字符以内。';
      return;
    }
    status.textContent = '正在对比…';
    result.setAttribute('aria-busy', 'true');
    task.run({
      kind: 'diff',
      left: left.value,
      right: right.value,
      json: selected('diff-mode') === 'json',
    });
  }
  const disposeInputs = reactiveInputs(root, run, clearResult);
  element(root, 'diff-swap').addEventListener(
    'click',
    () => {
      [left.value, right.value] = [right.value, left.value];
      clearResult();
      run();
      saveDraft();
    },
    { signal: events.signal },
  );
  element(root, 'diff-clear').addEventListener(
    'click',
    () => {
      left.value = '';
      right.value = '';
      setEditing(true);
      clearResult();
      status.textContent = '已清空';
      saveDraft();
    },
    { signal: events.signal },
  );
  for (const [id, input] of [
    ['copy-left', left],
    ['copy-right', right],
  ] as const) {
    const button = element<HTMLButtonElement>(root, id);
    button.addEventListener(
      'click',
      () => void copies.copy(button, input.value),
      { signal: events.signal },
    );
  }
  setEditing(true);
  status.textContent = '输入两侧内容后，点击“查看差异”。';
  const draft = readDiffDraft();
  if (draft) {
    left.value = draft.left;
    right.value = draft.right;
    element<HTMLSelectElement>(root, 'diff-mode').value = draft.mode;
    element<HTMLSelectElement>(root, 'diff-view').value = draft.view;
    element<HTMLInputElement>(root, 'diff-wrap').checked = draft.wrap;
    element<HTMLInputElement>(root, 'diff-hide').checked = draft.hideSame;
    for (const id of ['diff-mode', 'diff-view'])
      element(root, id).dispatchEvent(new Event('change', { bubbles: true }));
    updateWrap();
    updateCopyButtons(root);
    status.textContent = '已恢复本地保存的内容。';
  }
  root.addEventListener('input', saveDraft, { signal: events.signal });
  root.addEventListener('change', saveDraft, { signal: events.signal });
  return () => {
    disposeLayout();
    disposeTabs.forEach((dispose) => dispose());
    disposeInputs();
    events.abort();
    copies.dispose();
  };
}
