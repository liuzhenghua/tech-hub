import type {
  BrowserStorage,
  CacheData,
  DocumentEntry,
  Preview,
} from './types';
import { isDocumentPath } from '../document-paths';
const KEY = 'tech-hub:documents:v1';
export class DocumentCache {
  data: CacheData;
  constructor(
    private storage: BrowserStorage,
    private scope: string,
    directory = 'docs',
  ) {
    this.data = {
      scope,
      entries: [],
      documents: {},
      previews: {},
      updatedAt: 0,
    };
    try {
      const saved = JSON.parse(
        storage.getItem(KEY) || 'null',
      ) as CacheData | null;
      if (
        saved?.scope === scope &&
        Array.isArray(saved.entries) &&
        saved.documents &&
        typeof saved.documents === 'object'
      ) {
        this.data = saved;
        this.data.previews ||= {};
        this.data.entries = saved.entries.filter((x) =>
          isDocumentPath(x.path, directory),
        );
        for (const path of Object.keys(this.data.documents))
          if (!isDocumentPath(path, directory))
            delete this.data.documents[path];
      }
    } catch {
      /* Unavailable or corrupted browser storage is optional. */
    }
  }
  save() {
    try {
      this.storage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* Browsing still works if storage is full. */
    }
  }
  index(entries: DocumentEntry[]) {
    this.data.entries = entries;
    this.data.updatedAt = Date.now();
    const shas = new Map(entries.map((x) => [x.path, x.sha]));
    for (const [path, item] of Object.entries(this.data.documents))
      if (shas.get(path) !== item.sha) delete this.data.documents[path];
    for (const [path, item] of Object.entries(this.data.previews))
      if (shas.get(path) !== item.sha) delete this.data.previews[path];
    this.save();
  }
  preview(path: string) {
    return this.data.previews[path];
  }
  putPreview(path: string, sha: string | undefined, preview: Preview) {
    this.data.previews[path] = { ...preview, sha };
    this.save();
  }
  get(path: string) {
    return this.data.documents[path];
  }
  put(path: string, sha: string | undefined, markdown: string, title: string) {
    if (markdown.length > 150000) return;
    delete this.data.documents[path];
    this.data.documents[path] = { sha, markdown, title };
    const paths = Object.keys(this.data.documents);
    while (paths.length > 10) delete this.data.documents[paths.shift()!];
    this.save();
  }
  clear() {
    this.data = {
      scope: this.scope,
      entries: [],
      documents: {},
      previews: {},
      updatedAt: 0,
    };
    try {
      this.storage.removeItem(KEY);
    } catch {
      /* Storage may be disabled. */
    }
  }
}
