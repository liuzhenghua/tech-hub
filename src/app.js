import hljs from 'highlight.js/lib/common';
import 'highlight.js/styles/github.css';
import { normalizeDirectory } from './document-paths.js';
import { documentHash, parseRoute } from './routes.js';
import { enhanceDiagrams } from './diagrams.js';
import { DocumentCache } from './cache.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
const repository = (
  import.meta.env.VITE_GITHUB_REPOSITORY || 'liuzhenghua/tech'
).trim();
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
  throw Error('VITE_GITHUB_REPOSITORY 格式应为 owner/repo。');
const [owner, repoName] = repository.split('/');
const config = {
  owner,
  repo: repoName,
  docsDir: normalizeDirectory(import.meta.env.VITE_DOCS_DIR || 'docs'),
  tokenBox: import.meta.env.VITE_GITHUB_TOKEN_BOX || '',
};
import { Repository, unlockTokenBox, resolvePath } from './core.js';
const $ = (id) => document.getElementById(id),
  storageKey = 'tech-hub:passphrase:v1';
const siteTitle = import.meta.env.VITE_SITE_TITLE?.trim() || '文档与工具';
$('site-brand').textContent = siteTitle;
$('footer-brand').textContent = siteTitle;
let repo = null,
  entries = [],
  current = '',
  generation = 0,
  objectUrls = [];
let cache = null;
let rememberEnabled = false;
try {
  cache = new DocumentCache(
    localStorage,
    config.owner +
      '/' +
      config.repo +
      ':' +
      config.docsDir +
      ':' +
      config.tokenBox,
    config.docsDir,
  );
} catch {}
let unlockGeneration = 0;
let category = '';
const status = (message) => {
  $('status').textContent = message;
};
function clearDocument() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls = [];
  $('document').replaceChildren();
  $('doc-head').replaceChildren();
  $('outline').replaceChildren();
  $('outline').hidden = true;
}
function lock() {
  unlockGeneration++;
  generation++;
  repo?.close();
  repo = null;
  entries = [];
  current = '';
  clearDocument();
  cache?.clear();
  rememberEnabled = false;
  documentTitles.clear();
  previews.clear();
  previewObserver.disconnect();
  $('files').replaceChildren();
  $('workspace').hidden = true;
  $('unlock').hidden = false;
  $('lock').hidden = true;
  $('secret').value = '';
  $('total').textContent = '私有文档';
  try {
    localStorage.removeItem(storageKey);
  } catch {}
  status('已锁定，已清除保存的口令和当前文档。');
}
$('lock').onclick = lock;
const documentTitles = new Map();
const previews = new Map();
const pendingPreviews = new Set();
let previewRequests = 0;
function extractPreview(markdown) {
  // A card only needs the introduction, not a full-document parse.
  const tokens = marked.lexer(markdown.slice(0, 8000));
  const title = tokens.find((x) => x.type === 'heading' && x.depth === 1)?.text;
  const paragraph = tokens.find((x) => x.type === 'paragraph')?.text || '';
  const clean = DOMPurify.sanitize(marked.parseInline(paragraph), {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
  const element = document.createElement('textarea');
  element.innerHTML = clean;
  return { title, text: element.value.replace(/\s+/g, ' ').slice(0, 180) };
}
const previewObserver = new IntersectionObserver(
  (items) => {
    for (const item of items) if (item.isIntersecting) loadPreview(item.target);
  },
  { rootMargin: '150px' },
);
async function loadPreview(card) {
  const path = card.dataset.path;
  if (!repo || previewRequests >= 3 || pendingPreviews.has(path)) return;
  previewObserver.unobserve(card);
  const active = repo;
  pendingPreviews.add(path);
  previewRequests++;
  try {
    const markdown = await active.file(path);
    if (repo !== active) return;
    const preview = extractPreview(markdown);
    previews.set(path, preview);
    if (preview.title) documentTitles.set(path, preview.title);
    if (rememberEnabled)
      cache?.put(
        path,
        entries.find((x) => x.path === path)?.sha,
        markdown,
        preview.title || path,
      );
    if (card.isConnected) {
      if (preview.title) card.querySelector('h3').textContent = preview.title;
      card.querySelector('.document-excerpt').textContent =
        preview.text || '打开查看完整文档';
    }
  } catch {
    if (repo === active) previews.set(path, { text: '打开查看完整文档' });
    if (card.isConnected)
      card.querySelector('.document-excerpt').textContent = '打开查看完整文档';
  } finally {
    pendingPreviews.delete(path);
    previewRequests--;
    for (const card of $('files').querySelectorAll('[data-path]'))
      if (!previews.has(card.dataset.path)) previewObserver.observe(card);
  }
}
function renderList() {
  const query = $('search').value.trim().toLowerCase();
  const prefix = config.docsDir ? config.docsDir + '/' : '';
  const groups = [
    ...new Set(
      entries.map((x) => {
        const relative = x.path.slice(prefix.length).split('/');
        return relative.length > 1 ? prefix + relative[0] : '@root';
      }),
    ),
  ];
  $('categories').replaceChildren();
  for (const value of ['', ...groups]) {
    const button = document.createElement('button');
    button.textContent =
      value === '@root'
        ? '根目录'
        : value
          ? value.slice(prefix.length)
          : '全部';
    button.setAttribute('aria-pressed', String(value === category));
    button.onclick = () => {
      category = value;
      renderList();
    };
    $('categories').append(button);
  }
  const items = entries.filter(
    (x) =>
      (!category ||
        (category === '@root'
          ? !x.path.slice(prefix.length).includes('/')
          : x.path.startsWith(category + '/'))) &&
      (x.path + ' ' + (documentTitles.get(x.path) || ''))
        .toLowerCase()
        .includes(query),
  );
  $('results-count').textContent = `${items.length} 篇文档`;
  previewObserver.disconnect();
  $('files').replaceChildren();
  for (const item of items) {
    const button = document.createElement('button');
    button.className = 'document-card';
    const parts = item.path.split('/');
    const name = parts.pop().replace(/\.md$/i, '');
    const tag = document.createElement('small');
    tag.textContent = parts.join(' / ');
    const title = document.createElement('h3');
    title.textContent =
      documentTitles.get(item.path) ||
      (name.toLowerCase() === 'readme'
        ? (parts.at(-1) || config.repo) + ' · 概览'
        : name);
    const footer = document.createElement('span');
    footer.className = 'document-card-footer';
    footer.textContent = '阅读文档 ↗';
    const excerpt = document.createElement('p');
    excerpt.className = 'document-excerpt';
    const cached = rememberEnabled ? cache?.get(item.path) : null;
    const preview =
      previews.get(item.path) ||
      (cached ? extractPreview(cached.markdown) : null);
    excerpt.textContent = preview?.text || '正在加载摘要…';
    if (preview?.title) title.textContent = preview.title;
    button.dataset.path = item.path;
    button.append(tag, title, excerpt, footer);
    button.onclick = () => openDocument(item.path);
    $('files').append(button);
    if (!preview) previewObserver.observe(button);
  }
  if (!items.length) $('files').textContent = '没有匹配的文档。';
}
function showCatalog(updateUrl = true) {
  if (updateUrl) history.pushState(null, '', '#docs');
  generation++;
  current = '';
  clearDocument();
  $('doc-catalog').hidden = false;
  $('doc-detail').hidden = true;
  status('');
}
$('back-to-docs').onclick = () => showCatalog();
function renderOutline() {
  $('outline').replaceChildren();
  const headings = [...$('document').querySelectorAll('h2,h3')];
  $('outline').hidden = !headings.length;
  if (!headings.length) return;
  const title = document.createElement('strong');
  title.textContent = '本页目录';
  $('outline').append(title);
  for (const heading of headings) {
    const button = document.createElement('button');
    button.textContent = heading.textContent;
    button.className = heading.tagName === 'H3' ? 'outline-child' : '';
    button.onclick = () => heading.scrollIntoView({ block: 'start' });
    $('outline').append(button);
  }
}
$('search').oninput = renderList;
async function openDocument(path, anchor = '', updateUrl = true) {
  if (updateUrl) {
    const hash = documentHash(path, anchor);
    if (location.hash !== hash) history.pushState(null, '', hash);
  }
  const active = repo,
    id = ++generation;
  const cached = rememberEnabled ? cache?.get(path) : null;
  if (!active && !cached) {
    status('正在连接仓库，请稍后再试。');
    return;
  }
  $('doc-catalog').hidden = true;
  $('doc-detail').hidden = false;
  status(cached ? '' : '正在加载文档…');
  clearDocument();
  try {
    const markdown = cached?.markdown ?? (await active.file(path));
    if (id !== generation) return;
    current = path;
    renderList();
    $('doc-head').textContent = path.split('/').join(' / ');
    const fragment = DOMPurify.sanitize(marked.parse(markdown), {
      RETURN_DOM_FRAGMENT: true,
      FORBID_TAGS: [
        'style',
        'iframe',
        'form',
        'input',
        'video',
        'audio',
        'source',
        'svg',
        'math',
        'link',
        'object',
        'embed',
        'picture',
      ],
      FORBID_ATTR: ['style', 'srcset'],
    });
    // Block all automatic resource loading; private images are fetched explicitly below.
    const images = [];
    for (const img of fragment.querySelectorAll('img')) {
      const src = img.getAttribute('src');
      img.removeAttribute('src');
      images.push([img, src]);
    }
    for (const node of fragment.querySelectorAll('[href]')) {
      const href = node.getAttribute('href');
      if (!href) continue;
      if (/^https?:\/\//i.test(href)) {
        node.target = '_blank';
        node.rel = 'noopener noreferrer';
      } else if (href.startsWith('#')) {
        node.onclick = (e) => {
          e.preventDefault();
          const target = $('document').querySelector(
            `[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`,
          );
          target?.scrollIntoView();
        };
      } else if (!/^[a-z][a-z\d+.-]*:/i.test(href) && !href.startsWith('//')) {
        node.setAttribute('href', '#');
        node.onclick = (e) => {
          e.preventDefault();
          const [relative, hash = ''] = href.split('#');
          const resolved = resolvePath(path, decodeURIComponent(relative));
          if (/\.md$/i.test(resolved)) openDocument(resolved, hash);
          else status('此链接指向非 Markdown 文件，请在 GitHub 中查看。');
        };
      } else node.removeAttribute('href');
    }
    $('document').replaceChildren(fragment);
    for (const pre of $('document').querySelectorAll('pre')) {
      const code = pre.querySelector('code');
      if (!code || code.classList.contains('language-mermaid')) continue;
      const language = [...code.classList]
        .find((name) => name.startsWith('language-'))
        ?.slice(9);
      // Unknown languages remain readable plain text; avoid expensive auto-detection.
      if (language && hljs.getLanguage(language)) hljs.highlightElement(code);
      const button = document.createElement('button');
      button.className = 'copy-code';
      const copyIcon =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';
      button.innerHTML = copyIcon;
      button.title = '复制代码';
      button.setAttribute('aria-label', '复制代码');
      button.onclick = async () => {
        try {
          await navigator.clipboard.writeText(code.textContent);
          button.innerHTML =
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
          button.setAttribute('aria-label', '已复制');
        } catch {
          button.setAttribute('aria-label', '复制失败');
          status('浏览器未允许复制，请选中代码后手动复制。');
        }
        setTimeout(() => {
          button.innerHTML = copyIcon;
          button.setAttribute('aria-label', '复制代码');
        }, 2000);
      };
      pre.append(button);
    }

    const headings = new Map();
    for (const heading of $('document').querySelectorAll('h1,h2,h3,h4,h5,h6')) {
      const base = heading.textContent
        .toLowerCase()
        .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
        .replace(/ /g, '-');
      const n = headings.get(base) || 0;
      headings.set(base, n + 1);
      heading.id = base + (n ? `-${n}` : '');
    }
    for (const [img, src] of images) {
      if (!src || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(src)) {
        img.alt = (img.alt || '图片') + '（外部图片未自动加载）';
        continue;
      }
      try {
        if (!active) {
          img.alt += '（联网后可加载）';
          continue;
        }
        const image = await active.file(
          resolvePath(path, decodeURIComponent(src)),
          false,
        );
        if (id !== generation) return;
        const ext = image.path.split('.').pop().toLowerCase();
        const type = {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          webp: 'image/webp',
        }[ext];
        if (!type || image.encoding !== 'base64') continue;
        const bytes = Uint8Array.from(
          atob(image.content.replace(/\s/g, '')),
          (c) => c.charCodeAt(0),
        );
        const url = URL.createObjectURL(new Blob([bytes], { type }));
        objectUrls.push(url);
        img.src = url;
      } catch {
        img.alt += '（加载失败）';
      }
    }
    const title = $('document').querySelector('h1')?.textContent;
    if (title) {
      documentTitles.set(path, title);
      renderList();
    }
    renderOutline();
    if (rememberEnabled)
      cache?.put(
        path,
        entries.find((x) => x.path === path)?.sha,
        markdown,
        title || path.split('/').pop(),
      );
    $('doc-detail').querySelector('article').scrollTop = 0;
    const diagrams = [
      ...$('document').querySelectorAll('code.language-mermaid'),
    ];
    if (diagrams.length) {
      const { default: mermaid } = await import('mermaid');
      if (id !== generation) return;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'neutral',
      });
      for (const code of diagrams) {
        const target = document.createElement('div');
        target.className = 'mermaid';
        target.textContent = code.textContent;
        target.dataset.source = code.textContent;
        code.parentElement.replaceWith(target);
      }
      try {
        await mermaid.run({
          nodes: $('document').querySelectorAll('.mermaid'),
        });
        if (id === generation) enhanceDiagrams($('document'), status);
      } catch {
        if (id === generation)
          status('文档已加载；部分 Mermaid 图表无法渲染。');
        return;
      }
    }
    if (id !== generation) return;
    if (anchor)
      document.getElementById(decodeURIComponent(anchor))?.scrollIntoView();
    status('');
  } catch (error) {
    if (id === generation)
      status(error.name === 'AbortError' ? '加载已取消。' : error.message);
  }
}
$('unlock').onsubmit = async (event) => {
  event.preventDefault();
  const session = ++unlockGeneration;
  $('submit').disabled = true;
  $('submit').textContent = '正在解锁…';
  $('unlock').setAttribute('aria-busy', 'true');
  status('正在解密并读取仓库…');
  let candidate;
  try {
    const secret = $('secret').value;
    const token = await unlockTokenBox(config.tokenBox, secret);
    if (session !== unlockGeneration) return;
    candidate = new Repository(config, token);
    const files = await candidate.list();
    if (session !== unlockGeneration) {
      candidate.close();
      return;
    }
    const previousSha = entries.find((x) => x.path === current)?.sha;
    repo?.close();
    repo = candidate;
    entries = files;
    rememberEnabled = $('remember').checked;
    if (rememberEnabled) cache?.index(files);
    else cache?.clear();
    try {
      if ($('remember').checked) localStorage.setItem(storageKey, secret);
      else localStorage.removeItem(storageKey);
    } catch {
      status('浏览器不允许保存口令，本次仍可使用。');
    }
    $('secret').value = '';
    $('workspace').hidden = false;
    $('unlock').hidden = true;
    $('lock').hidden = false;
    $('total').textContent = `${files.length} 篇文档`;
    if (current && !files.some((x) => x.path === current)) showCatalog();
    renderList();
    status('');
    if (current && previousSha !== files.find((x) => x.path === current)?.sha)
      openDocument(current, '', false);
    else navigate();
  } catch (error) {
    candidate?.close();
    if (session === unlockGeneration) {
      if (candidate && entries.length) {
        status('暂时无法更新，正在显示本地缓存。' + error.message);
      } else {
        status(error.message);
      }
    }
  } finally {
    $('submit').disabled = false;
    $('submit').textContent = '解锁文档';
    $('unlock').removeAttribute('aria-busy');
  }
};
try {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    rememberEnabled = true;
    if (cache?.data.entries.length) {
      entries = cache.data.entries;
      for (const [path, item] of Object.entries(cache.data.documents))
        documentTitles.set(path, item.title);
      $('workspace').hidden = false;
      $('unlock').hidden = true;
      $('lock').hidden = false;
      $('total').textContent = `${entries.length} 篇文档`;
      renderList();
    }
    $('secret').value = saved;
    $('remember').checked = true;
    $('unlock').requestSubmit();
  }
} catch {}

function navigate() {
  if (location.hash === '#main-content') return;
  const route = parseRoute(location.hash, config.docsDir);
  const docs = route.docs;
  $('tools-page').hidden = docs;
  $('library').hidden = !docs;
  $('nav-tools').toggleAttribute('aria-current', !docs);
  $('nav-docs').toggleAttribute('aria-current', docs);
  if (!docs) $('nav-tools').setAttribute('aria-current', 'page');
  else $('nav-docs').setAttribute('aria-current', 'page');
  document.title = `${docs ? '文档' : '工具'} · ${siteTitle}`;
  if (
    docs &&
    route.path &&
    (repo || (rememberEnabled && cache?.get(route.path)))
  ) {
    if (current !== route.path) openDocument(route.path, route.anchor, false);
  } else if (docs && !route.path) showCatalog(false);
  else if (!docs) {
    generation++;
    current = '';
    clearDocument();
  }
}
window.addEventListener('hashchange', navigate);
window.addEventListener('popstate', navigate);
navigate();
