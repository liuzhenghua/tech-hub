import { config } from '../config';
import { parseRoute, documentHash } from '../routes';
import { isDocumentPath } from '../document-paths';
import { createCatalog } from '../documents/catalog';
import { createReader } from '../documents/reader';
import { mountDocumentExport } from '../documents/export';
import { mountBundleExport } from '../documents/bundle-export';

import template from './documents-page.html?raw';
import type { PageServices } from './types';

export function mountPage(
  root: HTMLElement,
  lockButton: HTMLButtonElement,
  services: PageServices,
) {
  root.innerHTML = template;
  function element<T extends HTMLElement>(id: string): T {
    const node = root.querySelector<T>(`#${id}`);
    if (!node) throw Error(`缺少页面元素 ${id}`);
    return node as T;
  }
  const secret = element<HTMLInputElement>('secret'),
    remember = element<HTMLInputElement>('remember'),
    form = element<HTMLFormElement>('unlock'),
    submit = element<HTMLButtonElement>('submit');
  const session = services.documentSession;
  let current = '',
    unlocking = 0,
    disposed = false;
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  const status = (text: string, duration = 0) => {
    clearTimeout(statusTimer);
    const node = element('status');
    node.textContent = text;
    node.classList.toggle('status-transient', Boolean(text && duration));
    if (text && duration) statusTimer = setTimeout(() => status(''), duration);
  };
  const reader = createReader(
    {
      body: element('document'),
      path: element('doc-head'),
      outline: element('outline'),
    },
    session,
    status,
    (path, anchor) => void openDocument(path, anchor),
    () => bundleExport.cancel(),
  );
  const catalog = createCatalog(
    {
      categories: element('categories'),
      files: element('files'),
      search: element<HTMLInputElement>('search'),
      total: element('total'),
    },
    session,
    (path) => void openDocument(path),
  );
  function catalogView(updateUrl = true) {
    if (updateUrl) history.pushState(null, '', '#/docs');
    current = '';
    reader.clear();
    element('doc-catalog').hidden = false;
    element('doc-detail').hidden = true;
    catalog.render();
    status('');
  }
  async function openDocument(path: string, anchor = '', updateUrl = true) {
    if (!isDocumentPath(path, config.docsDir)) return;
    if (updateUrl && location.hash !== documentHash(path, anchor))
      history.pushState(null, '', documentHash(path, anchor));
    current = path;
    element('doc-catalog').hidden = true;
    element('doc-detail').hidden = false;
    await reader.show(path, anchor);
  }
  function unlockedView() {
    element('workspace').hidden = false;
    form.hidden = true;
    lockButton.hidden = false;
    catalog.reset();
  }
  function navigate() {
    if (location.hash === '#main-content') return;
    status('');
    const route = parseRoute(location.hash, config.docsDir);
    if (route.path && (session.source || session.cache?.get(route.path))) {
      if (current !== route.path)
        void openDocument(route.path, route.anchor, false);
    } else if (!route.path) catalogView(false);
  }
  async function unlock(passphrase: string, save: boolean) {
    const generation = ++unlocking;
    submit.disabled = true;
    submit.textContent = '正在解锁…';
    form.setAttribute('aria-busy', 'true');
    status(
      session.entries.length ? '正在后台检查文档更新…' : '正在解密并读取仓库…',
    );
    const before = session.entries.find((entry) => entry.path === current)?.sha;
    try {
      if (
        !(await session.unlock(passphrase, save)) ||
        disposed ||
        generation !== unlocking
      )
        return;
      secret.value = '';
      unlockedView();
      status('');
      if (current && !session.entries.some((entry) => entry.path === current))
        catalogView();
      if (
        current &&
        before !== session.entries.find((entry) => entry.path === current)?.sha
      )
        void openDocument(current, '', false);
      else navigate();
    } catch (error) {
      if (generation === unlocking && !disposed)
        status(
          (session.entries.length ? '暂时无法更新，正在显示本地缓存。' : '') +
            (error instanceof Error ? error.message : String(error)),
        );
    } finally {
      if (generation === unlocking && !disposed) {
        submit.disabled = false;
        submit.textContent = '解锁文档';
        form.removeAttribute('aria-busy');
      }
    }
  }
  const events = new AbortController();
  const disposeExport = mountDocumentExport(reader.snapshot, status);
  const bundleExport = mountBundleExport(reader.snapshot, session, status);
  form.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      void unlock(secret.value, remember.checked);
    },
    { signal: events.signal },
  );
  lockButton.addEventListener(
    'click',
    () => {
      unlocking++;
      session.lock();
      reader.clear();
      current = '';
      catalog.reset();
      element('workspace').hidden = true;
      form.hidden = false;
      lockButton.hidden = true;
      secret.value = '';
      submit.disabled = false;
      submit.textContent = '解锁文档';
      form.removeAttribute('aria-busy');
      element('total').textContent = '私有文档';
      status('已锁定，已清除保存的口令和文档缓存。');
    },
    { signal: events.signal },
  );
  element('back-to-docs').addEventListener('click', () => catalogView(), {
    signal: events.signal,
  });
  window.addEventListener('hashchange', navigate, { signal: events.signal });
  window.addEventListener('popstate', navigate, { signal: events.signal });
  if (session.source) {
    remember.checked = session.remembersPassphrase;
    unlockedView();
  } else restore();
  function restore() {
    const saved = session.restore();
    if (!saved) return;
    remember.checked = true;
    if (session.entries.length) unlockedView();
    void unlock(saved, true);
  }
  navigate();
  function dispose() {
    disposed = true;
    clearTimeout(statusTimer);
    unlocking++;
    events.abort();
    disposeExport();
    bundleExport.dispose();
    catalog.dispose();
    reader.dispose();
    session.cancelPending();
  }
  return dispose;
}
