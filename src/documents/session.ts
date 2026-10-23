import { Repository } from './repository';
import { unlockTokenBox } from './token';
import { DocumentCache } from './cache';
import { documentGroups } from './groups';
import { buildDocumentIndex } from './indexer';
import { extractPreview } from './preview';
import type {
  BrowserStorage,
  DocumentEntry,
  Preview,
  DocumentSource,
  RepositoryConfig,
} from './types';
export const PASSPHRASE_KEY = 'tech-hub:passphrase:v1';
export class DocumentSession {
  entries: DocumentEntry[] = [];
  source: DocumentSource | null = null;
  readonly previews = new Map<string, Preview>();
  private generation = 0;
  private remember = false;
  private indexTask: { generation: number; promise: Promise<string[]> } | null =
    null;
  readonly cache: DocumentCache | null;
  constructor(
    readonly config: RepositoryConfig & { tokenBox: string },
    private storage: BrowserStorage | null,
    private connect: (token: string) => DocumentSource = (token) =>
      new Repository(config, token),
    private decrypt = unlockTokenBox,
  ) {
    this.cache = storage
      ? new DocumentCache(
          storage,
          `${config.owner}/${config.repo}:${config.docsDir ?? 'docs'}:${config.tokenBox}`,
          config.docsDir ?? 'docs',
        )
      : null;
  }
  restore(): string | null {
    let secret: string | null = null;
    try {
      secret = this.storage?.getItem(PASSPHRASE_KEY) || null;
    } catch {}
    if (!secret) return null;
    this.remember = true;
    this.entries = this.cache?.data.entries || [];
    for (const [path, preview] of Object.entries(
      this.cache?.data.previews || {},
    ))
      this.previews.set(path, preview);
    return secret;
  }
  async unlock(secret: string, remember: boolean): Promise<boolean> {
    const generation = ++this.generation;
    const token = await this.decrypt(this.config.tokenBox, secret);
    if (generation !== this.generation) return false;
    const candidate = this.connect(token);
    try {
      const entries = await candidate.list();
      if (generation !== this.generation) {
        candidate.close();
        return false;
      }
      this.source?.close();
      this.source = candidate;
      this.entries = entries;
      this.remember = remember;
      const shas = new Map(entries.map((entry) => [entry.path, entry.sha]));
      for (const [path, preview] of this.previews)
        if (shas.get(path) !== preview.sha) this.previews.delete(path);
      if (remember) this.cache?.index(entries);
      else this.cache?.clear();
      try {
        if (remember) this.storage?.setItem(PASSPHRASE_KEY, secret);
        else this.storage?.removeItem(PASSPHRASE_KEY);
      } catch {}
      return true;
    } catch (error) {
      candidate.close();
      throw error;
    }
  }
  async read(path: string): Promise<string> {
    const cached = this.remember ? this.cache?.get(path) : undefined;
    if (cached) return cached.markdown;
    if (!this.source) throw Error('正在连接仓库，未缓存的文档需要联网读取。');
    return this.source.file(path);
  }
  preview(path: string): Preview | undefined {
    return (
      this.previews.get(path) ||
      (this.remember ? this.cache?.preview(path) : undefined)
    );
  }
  record(path: string, markdown: string, preview: Preview) {
    const sha = this.entries.find((entry) => entry.path === path)?.sha;
    this.previews.set(path, { ...preview, sha });
    if (this.remember) {
      this.cache?.putPreview(path, sha, preview);
      this.cache?.put(path, sha, markdown, preview.title || path);
    }
  }
  buildIndex(): Promise<string[]> {
    if (this.indexTask?.generation === this.generation)
      return this.indexTask.promise;
    const generation = this.generation;
    const source = this.source;
    const promise = buildDocumentIndex(
      this.entries,
      (path) => this.preview(path),
      (path) => this.read(path),
      (path, markdown) => this.record(path, markdown, extractPreview(markdown)),
      () => generation === this.generation && source === this.source,
    ).finally(() => {
      if (this.indexTask?.promise === promise) this.indexTask = null;
    });
    this.indexTask = { generation, promise };
    return promise;
  }
  groups() {
    return documentGroups(this.entries, (path) => this.preview(path));
  }
  groupFor(path: string) {
    return this.groups().find(
      (group) =>
        group.entry.path === path ||
        group.children.some((child) => child.path === path),
    );
  }
  lock() {
    this.generation++;
    this.source?.close();
    this.source = null;
    this.entries = [];
    this.previews.clear();
    this.remember = false;
    this.cache?.clear();
    try {
      this.storage?.removeItem(PASSPHRASE_KEY);
    } catch {}
  }
  get remembersPassphrase() {
    return this.remember;
  }
  cancelPending() {
    this.generation++;
  }
  dispose() {
    this.generation++;
    this.source?.close();
    this.source = null;
  }
}
