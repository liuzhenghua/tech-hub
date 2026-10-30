import { readUsage, type ToolId } from './tool-usage';
/** Filter the tool directory locally without navigating or accessing documents. */
export function mountToolCatalog(root: HTMLElement): () => void {
  const search = root.querySelector<HTMLInputElement>('#tool-search')!;
  const empty = root.querySelector<HTMLElement>('#tool-empty')!;
  const normalize = (value: string) =>
    value.normalize('NFKC').toLocaleLowerCase();
  const cards = Array.from(root.querySelectorAll<HTMLElement>('.tool')).map(
    (card) => ({
      card,
      text: normalize(`${card.textContent} ${card.dataset.keywords || ''}`),
    }),
  );
  const events = new AbortController();
  const grid = root.querySelector<HTMLElement>('.tools-grid')!;
  for (const { card } of cards) {
    const footer = document.createElement('span');
    footer.className = 'tool-card-footer';
    const usage = document.createElement('span');
    usage.className = 'tool-usage';
    usage.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V13m7 7V4m7 16V9" /></svg><span></span>';
    footer.append(card.querySelector('.tool-link')!, usage);
    card.append(footer);
  }
  function updateUsage() {
    const counts = readUsage();
    const count = (card: HTMLElement) =>
      counts[card.dataset.toolId as ToolId] || 0;
    for (const { card } of cards) {
      const usage = card.querySelector<HTMLElement>('.tool-usage')!;
      usage.querySelector('span')!.textContent = String(count(card));
      usage.title = `使用 ${count(card)} 次`;
      usage.setAttribute('aria-label', usage.title);
    }
    const sorted = [...cards].sort((a, b) => count(b.card) - count(a.card));
    grid.append(...sorted.map(({ card }) => card));
  }
  window.addEventListener('storage', updateUsage, { signal: events.signal });
  window.addEventListener('pageshow', updateUsage, { signal: events.signal });
  window.addEventListener('focus', updateUsage, { signal: events.signal });
  updateUsage();
  function filter() {
    const terms = normalize(search.value).trim().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const { card, text } of cards) {
      card.hidden = !terms.every((term) => text.includes(term));
      if (!card.hidden) count++;
    }
    empty.hidden = count > 0;
  }
  search.addEventListener('input', filter, { signal: events.signal });
  filter();
  return () => events.abort();
}
