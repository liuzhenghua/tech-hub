import type { RegexMatch } from './regex';
export function highlightMatches(
  root: HTMLElement,
  text: string,
  matches: RegexMatch[],
) {
  const fragment = document.createDocumentFragment();
  let position = 0;
  for (const match of matches) {
    fragment.append(document.createTextNode(text.slice(position, match.start)));
    const mark = document.createElement('mark');
    mark.textContent = match.text || '▏';
    mark.title = `${match.start}–${match.end}${match.text ? '' : '（零宽匹配）'}`;
    fragment.append(mark);
    position = match.end;
  }
  fragment.append(document.createTextNode(text.slice(position)));
  root.replaceChildren(fragment);
}
export function matchCard(match: RegexMatch, index: number): HTMLElement {
  const card = document.createElement('section');
  card.className = 'regex-match';
  const heading = document.createElement('h3');
  heading.textContent = `匹配 ${index + 1} · ${match.start}–${match.end}`;
  const text = document.createElement('pre');
  text.textContent = match.text || '（零宽匹配）';
  card.append(heading, text);
  for (const group of match.groups) {
    const row = document.createElement('div');
    row.className = 'regex-group';
    const label = document.createElement('strong');
    label.textContent = group.name;
    const value = document.createElement('code');
    value.textContent =
      group.value === null ? '（未参与匹配）' : group.value || '（空字符串）';
    row.append(label, value);
    card.append(row);
  }
  return card;
}
