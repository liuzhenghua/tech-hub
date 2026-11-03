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
  t.mock.method(globalThis, 'fetch', async () => new Response('# 文档'));
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
