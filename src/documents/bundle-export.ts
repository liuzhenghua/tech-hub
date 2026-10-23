import type { DocumentSession } from './session';
import {
  collectDocumentBundle,
  documentBundleZip,
  type DocumentBundle,
} from './bundle';

export function mountBundleExport(
  snapshot: () => { path: string; markdown: string } | null,
  session: DocumentSession,
  status: (text: string, duration?: number) => void,
) {
  const button = document.querySelector<HTMLButtonElement>('#export-bundle')!;
  const dialog = document.querySelector<HTMLDialogElement>('#bundle-failures')!;
  const list = document.querySelector<HTMLUListElement>('#bundle-missing')!;
  const events = new AbortController();
  let generation = 0;
  let pending: {
    bundle: DocumentBundle;
    path: string;
    active: () => boolean;
  } | null = null;
  function cancel() {
    generation++;
    pending = null;
    dialog.close();
    button.removeAttribute('aria-busy');
    button.disabled = !snapshot();
  }
  function download(bundle: DocumentBundle, path: string) {
    const zip = documentBundleZip(bundle);
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(zip)], { type: 'application/zip' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = path.split('/').pop()!.replace(/\.md$/i, '') + '.zip';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status(
      bundle.failures.length
        ? '已导出已有内容，缺失清单见 ZIP 中的 EXPORT-MISSING.txt。'
        : '已导出 Markdown 文档包。',
      4000,
    );
  }
  function showFailures(
    bundle: DocumentBundle,
    path: string,
    active: () => boolean,
  ) {
    pending = { bundle, path, active };
    list.replaceChildren();
    for (const failure of bundle.failures) {
      const item = document.createElement('li');
      item.textContent = `${failure.path}：${failure.reason}`;
      list.append(item);
    }
    status('部分文件未能收录，请查看缺失清单。');
    dialog.showModal();
  }
  async function run() {
    cancel();
    const current = snapshot();
    if (!current) return;
    const repository = session.source;
    const id = generation;
    const active = () =>
      !events.signal.aborted &&
      id === generation &&
      snapshot() === current &&
      session.source === repository;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    document.querySelector<HTMLDetailsElement>('#document-export')!.open =
      false;
    status('正在打包主文档、子文档和本地图片…');
    try {
      const { bundle, path } = await collectGroupBundle(
        current,
        session,
        active,
      );
      if (!active()) return;
      if (bundle.failures.length) showFailures(bundle, path, active);
      else download(bundle, path);
    } catch (error) {
      if (active())
        status(error instanceof Error ? error.message : '打包失败，请重试。');
    } finally {
      if (active()) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    }
  }
  button.addEventListener('click', () => void run(), { signal: events.signal });
  document
    .getElementById('bundle-retry')!
    .addEventListener('click', () => void run(), { signal: events.signal });
  document.getElementById('bundle-continue')!.addEventListener(
    'click',
    () => {
      if (!pending?.active()) return cancel();
      try {
        download(pending.bundle, pending.path);
      } catch {
        status('生成 ZIP 失败，请重新导出。');
      }
      cancel();
    },
    { signal: events.signal },
  );
  document
    .getElementById('bundle-cancel')!
    .addEventListener('click', cancel, { signal: events.signal });
  dialog.addEventListener('cancel', cancel, { signal: events.signal });
  window.addEventListener('hashchange', cancel, { signal: events.signal });
  window.addEventListener('popstate', cancel, { signal: events.signal });
  return {
    cancel,
    dispose() {
      events.abort();
      cancel();
    },
  };
}

async function collectGroupBundle(
  current: { path: string; markdown: string },
  session: DocumentSession,
  active: () => boolean,
) {
  const repository = session.source;
  const missing = await session.buildIndex();
  if (!active()) throw new DOMException('导出已取消', 'AbortError');
  if (missing.length)
    throw Error(
      `文档索引不完整，无法确定子文档归属。请重试。未能读取：${missing.join('、')}`,
    );
  const group = session.groupFor(current.path);
  const path = group?.entry.path || current.path;
  const root = {
    path,
    markdown: path === current.path ? current.markdown : undefined,
  };
  if (!active()) throw new DOMException('导出已取消', 'AbortError');
  const bundle = await collectDocumentBundle(root, {
    directory: session.config.docsDir ?? 'docs',
    paths: group ? group.children.map((entry) => entry.path) : [],
    read: (path) => session.read(path),
    image: async (path) => {
      if (!repository) throw Error('本地图片需要联网读取，请解锁仓库后重试。');
      const image = await repository.file(path, false);
      if (image.encoding !== 'base64') throw Error('图片内容不可用');
      return Uint8Array.from(atob(image.content.replace(/\s/g, '')), (char) =>
        char.charCodeAt(0),
      );
    },
    active,
  });
  return { bundle, path };
}
