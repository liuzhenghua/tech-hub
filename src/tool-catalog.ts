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
