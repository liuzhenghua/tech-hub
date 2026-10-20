import { isDocumentPath } from './document-paths.js';
const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function unlockTokenBox(encoded, secret) {
  if (!encoded) throw Error('尚未配置加密 Token，请先完成站点配置。');
  if (!secret) throw Error('请输入解密口令。');
  try {
    const s = encoded.replace(/-/g, '+').replace(/_/g, '/'),
      box = JSON.parse(atob(s.padEnd(Math.ceil(s.length / 4) * 4, '=')));
    if (
      box.version !== 1 ||
      box.kdf !== 'PBKDF2-SHA256' ||
      box.iterations !== 600000
    )
      throw Error();
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: bytes(box.salt),
        iterations: box.iterations,
      },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const token = new TextDecoder()
      .decode(
        await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: bytes(box.iv) },
          key,
          bytes(box.ciphertext),
        ),
      )
      .trim();
    if (!token) throw Error();
    return token;
  } catch {
    throw Error('解密失败：口令错误或 Token 密文损坏。');
  }
}
export function resolvePath(current, relative) {
  const result = [];
  for (const p of `${current.slice(0, current.lastIndexOf('/') + 1)}${relative}`.split(
    '/',
  )) {
    if (p === '..') result.pop();
    else if (p && p !== '.') result.push(p);
  }
  return result.join('/');
}
export class Repository {
  constructor(config, token) {
    this.config = config;
    this.token = token;
    this.controller = new AbortController();
  }
  close() {
    this.controller.abort();
    this.token = '';
  }
  async request(path, raw = false) {
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
        cache: 'no-store',
        signal: this.controller.signal,
      },
    );
    if (!response.ok)
      throw Error(
        {
          401: 'Token 已失效，请重新配置。',
          403: '访问被拒绝或 API 额度已用尽。',
          404: !path
            ? `无法访问 ${owner}/${repo}：请确认 Token 的 Resource owner、已选仓库及读取权限。`
            : `GitHub 未找到 ${owner}/${repo}/${path.split('?')[0]}，请确认分支、文件路径及 Contents 读取权限。`,
        }[response.status] || `GitHub 请求失败（${response.status}）`,
      );
    return raw ? response.text() : response.json();
  }
  async list() {
    const meta = await this.request('');
    this.branch = meta.default_branch;
    const ref = await this.request(
      `git/ref/heads/${this.branch.split('/').map(encodeURIComponent).join('/')}`,
    );
    this.ref = ref.object.sha;
    const tree = await this.request(`git/trees/${this.ref}?recursive=1`);
    if (tree.truncated)
      throw Error('仓库目录过大，GitHub 返回了不完整的目录。');
    return tree.tree.filter(
      (x) =>
        x.type === 'blob' &&
        isDocumentPath(x.path, this.config.docsDir ?? 'docs'),
    );
  }
  async file(path, raw = true) {
    return this.request(
      `contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(this.ref)}`,
      raw,
    );
  }
}
