import { mountTime } from './time-panel';
import { mountDiff } from './diff-panel';
import { mountRegex } from './regex-panel';
import { recordUsage } from '../../tool-usage';
const tools = {
  timestamp: { title: '时间戳转换', mount: mountTime },
  diff: { title: '文本 / JSON 对比', mount: mountDiff },
  regex: { title: '正则表达式测试', mount: mountRegex },
};
const root = document.querySelector<HTMLElement>('#utility-panel')!;
const events = new AbortController();
type Draft = { value: string; checked?: boolean }[];
const drafts = new Map<string, Draft>();
const fields = () => [
  ...root.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >('input, select, textarea:not([readonly])'),
];
function saveDraft(mode: string) {
  drafts.set(
    mode,
    fields().map((node) => ({
      value: node.value,
      checked: node instanceof HTMLInputElement ? node.checked : undefined,
    })),
  );
}
function restoreDraft(mode: string) {
  const draft = drafts.get(mode);
  if (!draft) return;
  fields().forEach((node, index) => {
    const saved = draft[index];
    if (!saved) return;
    node.value = saved.value;
    if (node instanceof HTMLInputElement && saved.checked !== undefined)
      node.checked = saved.checked;
    if (node instanceof HTMLSelectElement)
      node.dispatchEvent(new Event('change', { bubbles: true }));
  });
  root.dispatchEvent(new Event('input', { bubbles: true }));
}
let active: string | undefined;
let dispose: (() => void) | undefined;
function navigate() {
  const hash = location.hash.slice(1);
  const mode = Object.hasOwn(tools, hash)
    ? (hash as keyof typeof tools)
    : 'timestamp';
  if (mode === active) return;
  if (active) saveDraft(active);
  recordUsage(mode, active === undefined);
  dispose?.();
  active = mode;
  dispose = tools[mode].mount(root);
  restoreDraft(mode);
  document.title = tools[mode].title;
  for (const button of document.querySelectorAll<HTMLElement>('[data-mode]'))
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
}
for (const button of document.querySelectorAll<HTMLButtonElement>(
  '[data-mode]',
))
  button.addEventListener(
    'click',
    () => {
      location.hash = button.dataset.mode!;
    },
    { signal: events.signal },
  );
window.addEventListener('hashchange', navigate, { signal: events.signal });
navigate();
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    events.abort();
    dispose?.();
  });
