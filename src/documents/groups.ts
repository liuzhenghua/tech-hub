import { matchesDocument } from './preview';
import type { DocumentEntry, Preview } from './types';

export interface DocumentGroup {
  entry: DocumentEntry;
  children: DocumentEntry[];
}
const directoryOf = (path: string) => path.slice(0, path.lastIndexOf('/') + 1);

/** Missing standalone metadata means a main document; only false means a child. */
export function documentGroups(
  entries: DocumentEntry[],
  preview: (path: string) => Preview | undefined,
): DocumentGroup[] {
  const groups = entries
    .filter((entry) => preview(entry.path)?.standalone !== false)
    .map((entry) => ({ entry, children: [] as DocumentEntry[] }));
  const directories = new Map<string, DocumentGroup[]>();
  for (const group of groups) {
    const directory = directoryOf(group.entry.path);
    directories.set(directory, [...(directories.get(directory) || []), group]);
  }
  function owner(path: string) {
    let directory = directoryOf(path);
    while (true) {
      const candidates = directories.get(directory);
      // An ambiguous directory must not assign a child to an arbitrary main document.
      if (candidates)
        return candidates.length === 1 ? candidates[0] : undefined;
      if (!directory) return undefined;
      directory = directoryOf(directory.slice(0, -1));
    }
  }
  for (const entry of entries) {
    if (preview(entry.path)?.standalone === false)
      owner(entry.path)?.children.push(entry);
  }
  return groups;
}

export function matchingGroupDocuments(
  group: DocumentGroup,
  preview: (path: string) => Preview | undefined,
  query: string,
) {
  const search = query.trim().toLowerCase();
  if (!search) return [];
  return [group.entry, ...group.children].filter((entry) =>
    matchesDocument(entry, preview(entry.path), search, '', ''),
  );
}
