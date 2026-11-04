import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Repository } from '../src/documents/repository';

const config = { owner: 'owner', repo: 'private-tech' };

test('large private images retain every binary byte using authenticated raw requests', async (t) => {
  const bytes = new Uint8Array(2_400_000);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
  const repository = new Repository(config, 'test-token');
  repository.ref = 'commit-sha';
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(
      url,
      'https://api.github.com/repos/owner/private-tech/contents/assets/architecture/overview.png?ref=commit-sha',
    );
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.headers.Accept, 'application/vnd.github.raw+json');
    assert.equal(options.cache, 'default');
    assert.equal(options.signal.aborted, false);
    return new Response(bytes);
  });
  const image = await repository.file(
    'assets/architecture/overview.png',
    false,
  );
  assert.equal(image.path, 'assets/architecture/overview.png');
  assert.equal(image.encoding, 'base64');
  assert.deepEqual(Buffer.from(image.content, 'base64'), Buffer.from(bytes));
});

test('Markdown still loads as text and image failures propagate', async (t) => {
  const repository = new Repository(config, 'test-token');
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options?.cache, 'default');
    return new Response('# 文档');
  });
  assert.equal(await repository.file('docs/example.md'), '# 文档');
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('', { status: 403 }),
  );
  await assert.rejects(
    repository.file('assets/image.png', false),
    /访问被拒绝/,
  );
});

test('closing the repository aborts pending image requests', async (t) => {
  const repository = new Repository(config, 'test-token');
  t.mock.method(
    globalThis,
    'fetch',
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      }),
  );
  const loading = repository.file('assets/image.png', false);
  repository.close();
  await assert.rejects(loading, { name: 'AbortError' });
});

test('image cache pins versions, shares downloads and clears on close', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(new Uint8Array([1, 2, 3]));
  });
  const repository = new Repository(config, 'token');
  repository.ref = 'one';
  await Promise.all([
    repository.file('assets/a.png', false),
    repository.file('assets/a.png', false),
  ]);
  await repository.file('assets/a.png', false);
  assert.equal(calls, 1);
  repository.ref = 'two';
  await repository.file('assets/a.png', false);
  assert.equal(calls, 2);
  repository.close();
  await assert.rejects(repository.file('assets/a.png', false), {
    name: 'AbortError',
  });
  const other = new Repository(config, 'token');
  other.ref = 'two';
  await other.file('assets/a.png', false);
  assert.equal(calls, 3);
});

test('unlock listing does not wait for per-document modification times', async (t) => {
  const calls: { url: string; cache: RequestCache | undefined }[] = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), cache: options?.cache });
    if (String(url).includes('commits?per_page=1'))
      return Response.json([{ sha: 'a'.repeat(40) }]);
    if (String(url).includes('git/trees/'))
      return Response.json({
        tree: [{ path: 'docs/a.md', sha: 'blob', type: 'blob' }],
      });
    return Response.json([
      { commit: { committer: { date: '2026-11-04T00:00:00Z' } } },
    ]);
  });
  const repository = new Repository(config, 'token');
  const entries = await repository.list();
  assert.equal(calls.length, 2);
  assert.equal(entries[0].modifiedAt, undefined);
  await repository.modificationTimes(entries);
  assert.equal(calls.length, 3);
  assert.match(calls[2].url, /sha=a{40}/);
  assert.equal(calls[2].cache, 'default');
  assert.equal(entries[0].modifiedAt, Date.parse('2026-11-04T00:00:00Z'));
});
