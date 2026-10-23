import type { DocumentEntry, Preview } from './types';

/** Read every uncached document so child ownership and full-text search are complete. */
export async function buildDocumentIndex(
  entries: DocumentEntry[],
  preview: (path: string) => Preview | undefined,
  read: (path: string) => Promise<string>,
  record: (path: string, markdown: string) => void,
  active: () => boolean,
) {
  const queue = entries.filter(
    (entry) => typeof preview(entry.path)?.searchText !== 'string',
  );
  const failures: string[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length && active()) {
      const entry = queue[cursor++];
      try {
        const markdown = await read(entry.path);
        if (active()) record(entry.path, markdown);
      } catch {
        if (active()) failures.push(entry.path);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(3, queue.length) }, () => worker()),
  );
  if (!active()) throw new DOMException('索引已取消', 'AbortError');
  return failures;
}
