import type { DocumentEntry } from './types';

export function compareModificationTimes(a: DocumentEntry, b: DocumentEntry) {
  const time = (entry: DocumentEntry) =>
    Number.isFinite(entry.modifiedAt) ? entry.modifiedAt! : -Infinity;
  if (time(a) !== time(b)) return time(a) > time(b) ? -1 : 1;
  return a.path < b.path ? -1 : Number(a.path > b.path);
}

/** Commit times belong to a repository snapshot, not just a blob (which can be reverted). */
export async function loadModificationTimes(
  entries: DocumentEntry[],
  cached: readonly DocumentEntry[],
  ref: string,
  read: (path: string) => Promise<number>,
  active: () => boolean,
) {
  const previous = new Map(cached.map((entry) => [entry.path, entry]));
  let cursor = 0;
  async function load(entry: DocumentEntry) {
    const saved = previous.get(entry.path);
    if (
      saved &&
      saved.sha === entry.sha &&
      saved.modifiedRef === ref &&
      Number.isFinite(saved.modifiedAt)
    ) {
      entry.modifiedAt = saved.modifiedAt;
      entry.modifiedRef = ref;
      return;
    }
    try {
      const time = await read(entry.path);
      if (active() && Number.isFinite(time)) {
        entry.modifiedAt = time;
        entry.modifiedRef = ref;
      }
    } catch {
      // An unavailable timestamp must not prevent reading the document library.
    }
  }
  async function worker() {
    while (cursor < entries.length && active()) await load(entries[cursor++]);
  }
  await Promise.all(
    Array.from({ length: Math.min(3, entries.length) }, worker),
  );
  if (!active()) throw new DOMException('修改时间加载已取消', 'AbortError');
}
