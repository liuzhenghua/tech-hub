export interface RegexMatch {
  text: string;
  start: number;
  end: number;
  groups: { name: string; value: string | null }[];
}
export function testRegex(
  pattern: string,
  flags: string,
  text: string,
): { matches: RegexMatch[]; truncated: boolean } {
  const regex = new RegExp(pattern, flags);
  const matches: RegexMatch[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (matches.length === 1000) return { matches, truncated: true };
    const numbered = match
      .slice(1)
      .map((value, i) => ({ name: `$${i + 1}`, value: value ?? null }));
    const named = Object.entries(match.groups ?? {}).map(([name, value]) => ({
      name,
      value: value ?? null,
    }));
    matches.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      groups: [...numbered, ...named],
    });
    if (!regex.global && !regex.sticky) break;
    if (match[0] === '')
      regex.lastIndex +=
        regex.unicode && (text.codePointAt(regex.lastIndex) ?? 0) > 0xffff
          ? 2
          : 1;
  }
  return { matches, truncated: false };
}
