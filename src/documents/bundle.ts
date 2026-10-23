import { marked } from 'marked';
import { zipSync } from 'fflate';
import { isDocumentPath } from '../document-paths';
import { parseFrontMatter } from './front-matter';

export interface BundleFailure {
  path: string;
  reason: string;
}
export interface DocumentBundle {
  files: Record<string, Uint8Array>;
  failures: BundleFailure[];
}
export interface BundleSource {
  directory: string;
  paths: readonly string[];
  read(path: string): Promise<string>;
  image(path: string): Promise<Uint8Array>;
  active(): boolean;
}
const MAX_FILES = 500;
const MAX_BYTES = 50 * 1024 * 1024;

function validateDocumentPath(path: string, directory: string) {
  if (!isDocumentPath(path, directory) || /[\\:\x00-\x1f\x7f]/.test(path))
    throw Error('文档路径无效或不在文档目录内');
}

function localReference(value: string) {
  return Boolean(value) && !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(value);
}

/** Resolve without allowing traversal beyond the repository root or unsafe ZIP names. */
export function bundlePath(current: string, reference: string) {
  if (!localReference(reference)) throw Error('必须使用仓库内的相对路径');
  const decoded = decodeURIComponent(reference.split(/[?#]/)[0]);
  if (!decoded || /[\\:\x00-\x1f\x7f]/.test(decoded) || decoded.startsWith('/'))
    throw Error('路径无效');
  const parts = current.split('/').slice(0, -1);
  for (const part of decoded.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) throw Error('路径超出仓库');
      parts.pop();
    } else parts.push(part);
  }
  return parts.join('/');
}

export function documentImages(markdown: string) {
  const images: string[] = [];
  marked.walkTokens(marked.lexer(parseFrontMatter(markdown).body), (token) => {
    if (token.type === 'image' && localReference(token.href))
      images.push(token.href);
    if (token.type === 'html') {
      const html = document.createElement('template');
      html.innerHTML = token.text;
      for (const image of html.content.querySelectorAll('img[src]')) {
        const src = image.getAttribute('src')!;
        if (localReference(src)) images.push(src);
      }
    }
  });
  return images;
}

export async function collectDocumentBundle(
  root: { path: string; markdown?: string },
  source: BundleSource,
): Promise<DocumentBundle> {
  validateDocumentPath(root.path, source.directory);
  const result: DocumentBundle = { files: Object.create(null), failures: [] };
  const visited = new Set<string>();
  const paths = source.paths.filter((path) => path !== root.path);
  const queue = [root.path, ...paths].map((path) => ({ path, image: false }));
  let bytes = 0;
  function checkActive() {
    if (!source.active()) throw new DOMException('导出已取消', 'AbortError');
  }
  function enqueue(current: string, reference: string) {
    try {
      const path = bundlePath(current, reference);
      if (!/\.(?:png|jpe?g|gif|webp|svg|avif|bmp|ico|apng)$/i.test(path))
        throw Error('不支持的图片格式');
      queue.push({ path, image: true });
    } catch (error) {
      result.failures.push({
        path: `${current} → ${reference}`,
        reason: String(error),
      });
    }
  }
  async function collect(item: { path: string; image: boolean }) {
    if (item.image) return source.image(item.path);
    validateDocumentPath(item.path, source.directory);
    const markdown =
      item.path === root.path && root.markdown !== undefined
        ? root.markdown
        : await source.read(item.path);
    checkActive();
    const content = new TextEncoder().encode(markdown);
    for (const image of documentImages(markdown)) enqueue(item.path, image);
    return content;
  }
  while (queue.length) {
    checkActive();
    const item = queue.shift()!;
    if (visited.has(item.path)) continue;
    visited.add(item.path);
    if (visited.size > MAX_FILES)
      throw Error('导出超过 500 个文件，请拆分主文档后重试。');
    try {
      const queued = queue.length;
      const content = await collect(item);
      checkActive();
      queue.unshift(...queue.splice(queued));
      result.files[item.path] = content;
      bytes += content.byteLength;
    } catch (error) {
      checkActive();
      result.failures.push({
        path: item.path,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    if (bytes > MAX_BYTES)
      throw Error('导出内容超过 50 MB，请拆分主文档后重试。');
  }
  return result;
}

export function documentBundleZip(bundle: DocumentBundle) {
  const files = { ...bundle.files };
  if (bundle.failures.length)
    files['EXPORT-MISSING.txt'] = new TextEncoder().encode(
      '此导出不完整。以下文件或依赖未能收录：\n' +
        bundle.failures
          .map(({ path, reason }) => `${path}: ${reason}`)
          .join('\n'),
    );
  return zipSync(files, { level: 0 });
}
