import { marked } from 'marked';
import { parseFrontMatter } from './front-matter';
import DOMPurify from 'dompurify';
import type { Preview, DocumentEntry } from './types';
export function extractPreview(markdown: string): Preview {
  const metadata = parseFrontMatter(markdown);
  const tokens = marked.lexer(metadata.body.slice(0, 8000));
  const heading = tokens.find(
    (token) => token.type === 'heading' && token.depth === 1,
  );
  const paragraph = tokens.find((token) => token.type === 'paragraph');
  const element = document.createElement('textarea');
  element.innerHTML = DOMPurify.sanitize(
    marked.parseInline(paragraph && 'text' in paragraph ? paragraph.text : '', {
      async: false,
    }),
    { ALLOWED_TAGS: [], ALLOWED_ATTR: [] },
  );
  return {
    standalone: metadata.standalone,
    searchText: metadata.body,
    title:
      metadata.title ||
      (heading && 'text' in heading ? heading.text : undefined),
    text: element.value.replace(/\s+/g, ' ').slice(0, 180),
  };
}
export function categoryOf(path: string, directory: string): string {
  const prefix = directory ? directory + '/' : '';
  const parts = path.slice(prefix.length).split('/');
  return parts.length > 1 ? prefix + parts[0] : '@root';
}
export function matchesDocument(
  entry: DocumentEntry,
  preview: Preview | undefined,
  query: string,
  category: string,
  directory: string,
): boolean {
  return (
    (!category || categoryOf(entry.path, directory) === category) &&
    [
      entry.path,
      preview?.title || '',
      preview?.text || '',
      preview?.searchText || '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  );
}
