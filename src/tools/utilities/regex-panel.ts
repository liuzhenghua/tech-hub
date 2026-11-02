import markup from './regex-panel.html?raw';
import type { RegexMatch } from './regex';
import { highlightMatches, matchCard } from './regex-render';
import { createAnalysisTask } from './task';
import {
  element,
  reactiveInputs,
  copyActions,
  decorateCopyButtons,
  updateCopyButtons,
} from './ui';
import { mountRegexSyntax } from './regex-syntax';
import { readRegexDraft, writeRegexDraft } from './regex-storage';
export function mountRegex(root: HTMLElement): () => void {
  root.innerHTML = markup;
  decorateCopyButtons(root);
  const disposeSyntax = mountRegexSyntax(root);
  const status = element(root, 'utility-status');
  const copies = copyActions(status);
  const pattern = element<HTMLInputElement>(root, 'regex-pattern');
  const text = element<HTMLTextAreaElement>(root, 'regex-text');
  const matches = element(root, 'regex-matches');
  const highlighted = element(root, 'regex-highlight');
  const events = new AbortController();
  const flags = [
    ...root.querySelectorAll<HTMLInputElement>('[name="regex-flag"]'),
  ];
  function saveDraft() {
    if (
      !writeRegexDraft({
        pattern: pattern.value,
        text: text.value,
        flags: flags
          .filter((flag) => flag.checked)
          .map((flag) => flag.value)
          .join(''),
      })
    )
      status.textContent = '本地保存失败，请复制重要内容。';
  }
  const copy = element<HTMLButtonElement>(root, 'copy-regex-text');
  copy.addEventListener('click', () => void copies.copy(copy, text.value), {
    signal: events.signal,
  });
  const task = createAnalysisTask<{
    matches: RegexMatch[];
    truncated: boolean;
  }>(
    (result) => {
      if (!root.isConnected) return;
      status.textContent = `${result.matches.length} 个匹配${result.truncated ? '（仅显示前 1,000 个）' : ''}`;
      highlightMatches(highlighted, text.value, result.matches);
      matches.replaceChildren(...result.matches.map(matchCard));
      matches.removeAttribute('aria-busy');
    },
    (message) => {
      status.textContent = message;
      matches.removeAttribute('aria-busy');
    },
  );
  function clearResult() {
    updateCopyButtons(root);
    task.cancel();
    matches.replaceChildren();
    matches.removeAttribute('aria-busy');
    highlighted.textContent = text.value;
    status.textContent = '等待测试…';
  }
  function run() {
    if (!pattern.value) {
      status.textContent = '请输入正则表达式。';
      return;
    }
    if (text.value.length > 1_000_000 || pattern.value.length > 10_000) {
      status.textContent =
        '输入过大：测试文本最多 100 万字符，表达式最多 1 万字符。';
      return;
    }
    const flags = [
      ...root.querySelectorAll<HTMLInputElement>('[name="regex-flag"]:checked'),
    ]
      .map((input) => input.value)
      .join('');
    status.textContent = '正在匹配…';
    matches.setAttribute('aria-busy', 'true');
    task.run({
      kind: 'regex',
      pattern: pattern.value,
      flags,
      text: text.value,
    });
  }
  const disposeInputs = reactiveInputs(root, run, clearResult);
  function example() {
    pattern.value = String.raw`(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})`;
    text.value =
      '今天是 2024-03-15，会议安排在 2024-04-01。\n项目截止日期：2024-12-25。';
    clearResult();
    run();
    saveDraft();
  }
  element(root, 'regex-example').addEventListener('click', example, {
    signal: events.signal,
  });
  element(root, 'regex-clear').addEventListener(
    'click',
    () => {
      pattern.value = '';
      text.value = '';
      clearResult();
      status.textContent = '已清空';
      saveDraft();
    },
    { signal: events.signal },
  );
  status.textContent = '输入表达式和测试文本，或填入日期示例。';
  const draft = readRegexDraft();
  if (draft) {
    pattern.value = draft.pattern;
    text.value = draft.text;
    flags.forEach((flag) => {
      flag.checked = draft.flags.includes(flag.value);
    });
    clearResult();
    if (pattern.value) run();
  }
  root.addEventListener('input', saveDraft, { signal: events.signal });
  root.addEventListener('change', saveDraft, { signal: events.signal });
  return () => {
    disposeSyntax();
    disposeInputs();
    events.abort();
    copies.dispose();
  };
}
