import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog, type CatalogElements } from '../src/documents/catalog';
import type { DocumentSession } from '../src/documents/session';

// Minimal DOM surface for catalog interaction and asynchronous refresh regressions.
class Element extends EventTarget {
  children: Element[] = [];
  className = '';
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  value = '';
  open = false;
  onclick?: () => void;
  private text = '';
  constructor(readonly tagName: string) {
    super();
  }
  set textContent(value: string) {
    this.text = value;
    this.children = [];
  }
  get textContent(): string {
    return (
      this.text + this.children.map((child) => child.textContent).join(' ')
    );
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  replaceChildren() {
    this.text = '';
    this.children = [];
  }
  append(...children: Element[]) {
    this.children.push(...children);
  }
  prepend(...children: Element[]) {
    this.children.unshift(...children);
  }
  descendants(): Element[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
}
function fixture(t: { after(fn: () => void): void }) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: (name: string) => new Element(name) },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  const elements = {
    categories: new Element('div'),
    search: new Element('input'),
    files: new Element('div'),
    total: new Element('span'),
  };
  const entry = { path: 'docs/topic/main.md', sha: 'sha' };
  let calls = 0;
  let resolve: ((failures: string[]) => void) | undefined;
  const session = {
    source: null as object | null,
    config: { docsDir: 'docs', repo: 'repo' },
    entries: [entry],
    preview: () => ({
      title: '缓存主文档',
      text: '缓存摘要',
      standalone: true,
      searchText: '正文',
    }),
    groups: () => [{ entry, children: [] }],
    buildIndex: () => {
      calls++;
      return new Promise<string[]>((done) => {
        resolve = done;
      });
    },
  };
  const catalog = createCatalog(
    elements as unknown as CatalogElements,
    session as unknown as DocumentSession,
    () => {},
  );
  t.after(catalog.dispose);
  return {
    elements,
    session,
    catalog,
    calls: () => calls,
    finish: async (failures: string[]) => {
      resolve?.(failures);
      await new Promise((done) => setImmediate(done));
    },
  };
}

test('restoring cached catalog before repository connection does not attempt indexing or report failures', (t) => {
  const { catalog, elements, calls } = fixture(t);
  catalog.reset();
  assert.equal(calls(), 0);
  assert.match(elements.files.textContent, /缓存主文档/);
  assert.doesNotMatch(elements.files.textContent, /暂未更新|查看详情/);
});

test('background indexing preserves cached cards and permits cached full-text search', async (t) => {
  const { catalog, elements, session, finish } = fixture(t);
  session.source = {};
  catalog.reset();
  assert.match(elements.files.textContent, /缓存主文档/);
  assert.match(elements.total.textContent, /更新中/);
  elements.search.value = '正文';
  elements.search.dispatchEvent(new Event('input'));
  assert.match(elements.files.textContent, /缓存主文档/);
  await finish([]);
  assert.doesNotMatch(elements.total.textContent, /更新中/);
  assert.match(elements.files.textContent, /缓存主文档/);
});

test('real indexing failures use collapsed details and retry removes the notice after success', async (t) => {
  const { catalog, elements, session, finish, calls } = fixture(t);
  session.source = {};
  catalog.reset();
  await finish(Array.from({ length: 65 }, (_, i) => `docs/failed-${i}.md`));
  const notice = elements.files.children.find(
    (child) => child.className === 'document-index-notice',
  )!;
  assert.ok(notice);
  const details = notice.children.find((child) => child.tagName === 'details')!;
  assert.equal(details.open, false);
  assert.equal(
    details.descendants().filter((child) => child.tagName === 'li').length,
    65,
  );
  assert.match(elements.files.textContent, /缓存主文档/);
  notice.descendants().find((child) => child.tagName === 'button')!.onclick!();
  assert.equal(calls(), 2);
  assert.equal(
    elements.files.children.some(
      (child) => child.className === 'document-index-notice',
    ),
    false,
  );
  await finish([]);
  assert.doesNotMatch(elements.files.textContent, /暂未更新|查看详情/);
});
