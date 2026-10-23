import { config } from './config';
import { parseRoute } from './routes';
import { mountSiteHeader } from './components/site-header';
import type { PageServices } from './pages/types';

const view = document.querySelector<HTMLElement>('#page-view')!;
const header = mountSiteHeader(
  document.querySelector('#site-header')!,
  config.title,
);
document.querySelector('#footer-brand')!.textContent = config.title;
const events = new AbortController();
let generation = 0;
let current: 'tools' | 'docs' | null = null;
let disposePage: (() => void) | undefined;
let services: PageServices | undefined;
let disposed = false;

async function mountDocuments() {
  const [{ mountPage }, { DocumentSession }] = await Promise.all([
    import('./pages/documents-page'),
    import('./documents/session'),
  ]);
  if (disposed) throw new DOMException('页面已销毁', 'AbortError');
  if (!services) {
    let storage: Storage | null = null;
    try {
      storage = localStorage;
    } catch {}
    services = { documentSession: new DocumentSession(config, storage) };
  }
  return () => mountPage(view, header.lockButton, services!);
}

async function mountTools() {
  const { mountPage } = await import('./pages/tools-page');
  return () => mountPage(view);
}

function loading() {
  const message = document.createElement('p');
  message.setAttribute('role', 'status');
  message.textContent = '正在加载…';
  view.replaceChildren(message);
}

function failed() {
  const message = document.createElement('p');
  message.textContent = '页面加载失败，请重试。';
  const retry = document.createElement('button');
  retry.textContent = '重试';
  retry.onclick = () => {
    current = null;
    void navigate();
  };
  view.replaceChildren(message, retry);
}

async function navigate() {
  if (location.hash === '#main-content') return;
  const page = parseRoute(location.hash, config.docsDir).docs
    ? 'docs'
    : 'tools';
  if (page === current) return;
  current = page;
  const id = ++generation;
  disposePage?.();
  disposePage = undefined;
  header.setPage(page);
  document.title = `${page === 'docs' ? '文档' : '工具'} · ${config.title}`;
  loading();
  try {
    const mount = await (page === 'docs' ? mountDocuments() : mountTools());
    if (disposed || id !== generation) return;
    disposePage = mount();
  } catch {
    if (!disposed && id === generation) failed();
  }
}
document.querySelector('.skip-link')!.addEventListener(
  'click',
  (event) => {
    event.preventDefault();
    document.querySelector<HTMLElement>('#main-content')!.focus();
  },
  { signal: events.signal },
);
window.addEventListener('hashchange', () => void navigate(), {
  signal: events.signal,
});
window.addEventListener('popstate', () => void navigate(), {
  signal: events.signal,
});
void navigate();
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    disposed = true;
    generation++;
    events.abort();
    disposePage?.();
    services?.documentSession.dispose();
  });
