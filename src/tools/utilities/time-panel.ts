import markup from './time-panel.html?raw';
import { timestampDate, formatDate, parseDate } from './time';
import {
  element,
  copyActions,
  decorateCopyButtons,
  updateCopyButtons,
} from './ui';
import { mountOptionTabs } from '../shared/option-tabs';
export function mountTime(root: HTMLElement): () => void {
  root.innerHTML = markup;
  decorateCopyButtons(root);
  const status = element(root, 'utility-status');
  const copies = copyActions(status);
  const events = new AbortController();
  const disposeTabs = ['time-zone', 'time-unit'].map((id) =>
    mountOptionTabs(element<HTMLSelectElement>(root, id)),
  );
  const input = (id: string) =>
    element<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      root,
      id,
    );
  const utc = () => input('time-zone').value === 'utc';
  element(root, 'zone-name').textContent =
    `本地：${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  function convert(direction: 'date' | 'stamp') {
    status.textContent = '';
    try {
      if (direction === 'date') {
        const date = timestampDate(
          input('timestamp').value,
          input('time-unit').value,
        );
        input('date-output').value =
          `${formatDate(date, utc())} ${utc() ? 'UTC' : '（本地时间）'}\nISO：${date.toISOString()}`;
      } else {
        const date = parseDate(input('date-input').value, utc());
        input('stamp-output').value =
          `秒：${Math.floor(date.getTime() / 1000)}\n毫秒：${date.getTime()}`;
      }
      status.textContent = '转换完成';
    } catch (error) {
      input(direction === 'date' ? 'date-output' : 'stamp-output').value = '';
      status.textContent =
        error instanceof Error ? error.message : String(error);
    } finally {
      updateCopyButtons(root);
    }
  }
  function now() {
    const date = new Date();
    input('timestamp').value = String(
      input('time-unit').value === 'seconds'
        ? Math.floor(date.getTime() / 1000)
        : date.getTime(),
    );
    input('date-input').value = formatDate(date, utc());
    convert('date');
    convert('stamp');
  }
  element(root, 'time-now').addEventListener('click', now, {
    signal: events.signal,
  });
  element(root, 'time-convert').addEventListener(
    'click',
    () => convert('date'),
    { signal: events.signal },
  );
  element(root, 'date-convert').addEventListener(
    'click',
    () => convert('stamp'),
    { signal: events.signal },
  );
  function clearResults() {
    input('date-output').value = '';
    input('stamp-output').value = '';
    status.textContent = '';
    updateCopyButtons(root);
  }
  root.addEventListener('input', clearResults, { signal: events.signal });
  root.addEventListener('change', clearResults, { signal: events.signal });
  for (const [button, target] of [
    ['copy-date', 'date-output'],
    ['copy-stamp', 'stamp-output'],
  ]) {
    const node = element<HTMLButtonElement>(root, button);
    node.addEventListener(
      'click',
      () => void copies.copy(node, input(target).value),
      { signal: events.signal },
    );
  }
  now();
  return () => {
    events.abort();
    copies.dispose();
    disposeTabs.forEach((dispose) => dispose());
  };
}
