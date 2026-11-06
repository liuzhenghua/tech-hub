import { isDocumentPath } from '../document-paths';
import { encodeBytes } from '../tools/shared/bytes';
import { loadModificationTimes } from './modification-times';
import { ImageCache } from './image-cache';
import type { RepositoryConfig, DocumentEntry, RepositoryImage } from './types';
export class Repository {
  private controller: AbortController;
  private images = new ImageCache();
  ref = '';
  private previous: readonly DocumentEntry[] = [];
  constructor(
    public config: RepositoryConfig,
    public token: string,
  ) {
    this.controller = new AbortController();
  }
  close() {
    this.controller.abort();
    this.images.clear();
    this.token = '';
  }
  async request(
    path: string,
    raw: boolean | 'binary' = false,
    cache: RequestCache = 'no-store',
  ): Promise<unknown> {
    const { owner, repo } = this.config;
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${path ? `/${path}` : ''}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: raw
            ? 'application/vnd.github.raw+json'
            : 'application/vnd.github+json',
        },
        // Versioned resources opt into HTTP caching; moving refs are revalidated.
        cache,
        signal: this.controller.signal,
      },
    );
    if (!response.ok)
      throw Error(
        (
          {
            401: 'Token 已失效，请重新配置。',
            403: '访问被拒绝或 API 额度已用尽。',
            404: !path
              ? `无法访问 ${owner}/${repo}：请确认 Token 的 Resource owner、已选仓库及读取权限。`
              : `GitHub 未找到 ${owner}/${repo}/${path.split('?')[0]}，请确认分支、文件路径及 Contents 读取权限。`,
          } as Record<number, string>
        )[response.status] || `GitHub 请求失败（${response.status}）`,
      );
    if (raw === 'binary') return response.arrayBuffer();
    return raw ? response.text() : response.json();
  }
  async list(cached: readonly DocumentEntry[] = []) {
    const commits = (await this.request(
      'commits?per_page=1',
      false,
      'no-cache',
    )) as { sha: string }[];
    if (!/^[a-f0-9]{40,64}$/i.test(commits[0]?.sha || ''))
      throw Error('仓库最新提交无效');
    this.ref = commits[0].sha;
    this.previous = cached;
    const tree = (await this.request(
      `git/trees/${this.ref}?recursive=1`,
      false,
      'default',
    )) as {
      truncated?: boolean;
      tree: DocumentEntry[];
    };
    if (tree.truncated)
      throw Error('仓库目录过大，GitHub 返回了不完整的目录。');
    const entries = tree.tree.filter(
      (x) =>
        x.type === 'blob' &&
        isDocumentPath(x.path, this.config.docsDir ?? 'docs'),
    );
    const previous = new Map(cached.map((entry) => [entry.path, entry]));
    for (const entry of entries) {
      const saved = previous.get(entry.path);
      if (!Number.isFinite(saved?.modifiedAt)) continue;
      // Keep the last known order until this snapshot's timestamps are ready.
      entry.modifiedAt = saved!.modifiedAt;
      entry.modifiedRef = saved!.modifiedRef;
    }
    return entries;
  }
  async modificationTimes(entries: DocumentEntry[]) {
    await loadModificationTimes(
      entries,
      this.previous,
      this.ref,
      async (path) => {
        const params = new URLSearchParams({
          path,
          sha: this.ref,
          per_page: '1',
        });
        const commits = (await this.request(
          `commits?${params}`,
          false,
          'default',
        )) as {
          commit?: { committer?: { date?: string } };
        }[];
        return Date.parse(commits[0]?.commit?.committer?.date || '');
      },
      () => !this.controller.signal.aborted,
    );
    this.previous = entries;
  }
  file(path: string): Promise<string>;
  file(path: string, raw: true): Promise<string>;
  file(path: string, raw: false): Promise<RepositoryImage>;
  async file(path: string, raw = true): Promise<string | RepositoryImage> {
    const endpoint = `contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(this.ref)}`;
    if (raw) return this.request(endpoint, true, 'default') as Promise<string>;
    this.controller.signal.throwIfAborted();
    return this.images.get(endpoint, () => this.readImage(path, endpoint));
  }
  private async readImage(
    path: string,
    endpoint: string,
  ): Promise<RepositoryImage> {
    this.controller.signal.throwIfAborted();
    // Raw responses preserve binary files, including images over the JSON API's 1 MB limit.
    const content = (await this.request(
      endpoint,
      'binary',
      'default',
    )) as ArrayBuffer;
    return {
      path,
      encoding: 'base64',
      content: encodeBytes(new Uint8Array(content), 'Base64'),
    };
  }
}
