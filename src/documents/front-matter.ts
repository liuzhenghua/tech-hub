import { parseDocument, isMap, isScalar } from 'yaml';

export function parseFrontMatter(markdown: string): {
  body: string;
  title?: string;
  standalone: boolean;
} {
  const fallback = { body: markdown, standalone: true };
  const match =
    /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m.exec(markdown);
  if (!match || match.index !== 0) return fallback;
  const document = parseDocument(match[1], { uniqueKeys: true });
  if (document.errors.length || !isMap(document.contents)) return fallback;
  const title = document.contents.get('title', true);
  const standalone = document.contents.get('standalone', true);
  const titleValue: unknown = isScalar(title) ? title.value : undefined;
  const standaloneValue: unknown = isScalar(standalone)
    ? standalone.value
    : undefined;
  return {
    body: markdown.slice(match[0].length),
    title:
      typeof titleValue === 'string'
        ? titleValue.trim() || undefined
        : undefined,
    standalone: standaloneValue !== false,
  };
}
