import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentSession, PASSPHRASE_KEY } from '../src/documents/session';
import type {
  BrowserStorage,
  DocumentSource,
  DocumentEntry,
  RepositoryImage,
} from '../src/documents/types';
const config = {
  owner: 'owner',
  repo: 'repo',
  docsDir: 'docs',
  tokenBox: 'encrypted',
};
function storage(): BrowserStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}
function source(
  entries: DocumentEntry[],
): DocumentSource & { closed: boolean } {
  return {
    closed: false,
    list: async () => entries,
    file: ((path: string, raw = true) =>
      Promise.resolve(
        raw ? '# ' + path : { path, encoding: 'base64', content: '' },
      )) as DocumentSource['file'],
    close() {
      this.closed = true;
    },
  };
}
test('remembered session restores summaries offline and invalidates changed SHA', async () => {
  const store = storage();
  const first = source([{ path: 'docs/a.md', sha: 'one' }]);
  const session = new DocumentSession(
    config,
    store,
    () => first,
    async () => 'token',
  );
  assert.ok(await session.unlock('password', true));
  session.record('docs/a.md', '# A', {
    title: 'A',
    text: 'summary',
    standalone: false,
  });
  const restored = new DocumentSession(
    config,
    store,
    () => source([{ path: 'docs/a.md', sha: 'two' }]),
    async () => 'token',
  );
  assert.equal(restored.restore(), 'password');
  assert.equal(restored.preview('docs/a.md')?.text, 'summary');
  assert.equal(restored.preview('docs/a.md')?.standalone, false);
  assert.equal(await restored.read('docs/a.md'), '# A');
  assert.equal(await restored.read('docs/a.md'), '# A');
  await restored.unlock('password', true);
  assert.equal(restored.preview('docs/a.md'), undefined);
  restored.lock();
  assert.equal(store.getItem(PASSPHRASE_KEY), null);
  assert.equal(restored.entries.length, 0);
  assert.equal(restored.cache?.get('docs/a.md'), undefined);
});
test('locking during index request prevents late unlock and closes candidate', async () => {
  let resolve!: (value: DocumentEntry[]) => void;
  const candidate = source([]);
  candidate.list = () =>
    new Promise((done) => {
      resolve = done;
    });
  const session = new DocumentSession(
    config,
    storage(),
    () => candidate,
    async () => 'token',
  );
  const pending = session.unlock('secret', true);
  await Promise.resolve();
  session.lock();
  resolve([{ path: 'docs/a.md', sha: 'sha' }]);
  assert.equal(await pending, false);
  assert.equal(session.source, null);
  assert.equal(candidate.closed, true);
});
test('failed refresh preserves existing readable session and non-remembered access clears persistent content', async () => {
  const first = source([{ path: 'docs/a.md', sha: 'one' }]);
  let next: DocumentSource = first;
  const store = storage();
  const session = new DocumentSession(
    config,
    store,
    () => next,
    async () => 'token',
  );
  await session.unlock('secret', true);
  session.record('docs/a.md', 'body', { text: 'summary' });
  next = source([]);
  next.list = async () => {
    throw Error('offline');
  };
  await assert.rejects(session.unlock('secret', true), /offline/);
  assert.equal(await session.read('docs/a.md'), 'body');
  assert.equal(first.closed, false);
  next = source([{ path: 'docs/a.md', sha: 'one' }]);
  await session.unlock('secret', false);
  assert.equal(store.getItem(PASSPHRASE_KEY), null);
  assert.equal(session.cache?.get('docs/a.md'), undefined);
  assert.equal(first.closed, true);
  session.dispose();
  assert.equal(session.source, null);
});

test('leaving a route invalidates pending unlock while keeping the active session and remember preference', async () => {
  const first = source([{ path: 'docs/a.md', sha: 'one' }]);
  let next = first;
  const session = new DocumentSession(
    config,
    storage(),
    () => next,
    async () => 'token',
  );
  await session.unlock('secret', false);
  assert.equal(session.remembersPassphrase, false);
  next = source([]);
  let resolve!: (entries: DocumentEntry[]) => void;
  next.list = () =>
    new Promise((done) => {
      resolve = done;
    });
  const pending = session.unlock('secret', true);
  await Promise.resolve();
  session.cancelPending();
  resolve([{ path: 'docs/b.md', sha: 'two' }]);
  assert.equal(await pending, false);
  assert.equal(session.source, first);
  assert.equal(first.closed, false);
  assert.equal(next.closed, true);
  assert.equal(session.remembersPassphrase, false);
  assert.equal(await session.read('docs/a.md'), '# docs/a.md');
  session.dispose();
});
