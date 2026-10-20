import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';
import { unlockTokenBox, resolvePath, Repository } from '../src/core.js';
test('pwa-apps compatible encrypted token unlocks and rejects wrong key', async () => {
  const salt = randomBytes(16),
    iv = randomBytes(12),
    cipher = createCipheriv(
      'aes-256-gcm',
      pbkdf2Sync('test key', salt, 600000, 32, 'sha256'),
      iv,
    );
  const ciphertext = Buffer.concat([
    cipher.update('test-token'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const encoded = Buffer.from(
    JSON.stringify({
      version: 1,
      kdf: 'PBKDF2-SHA256',
      iterations: 600000,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    }),
  ).toString('base64url');
  assert.equal(await unlockTokenBox(encoded, 'test key'), 'test-token');
  await assert.rejects(unlockTokenBox(encoded, 'wrong'));
  await assert.rejects(unlockTokenBox('', 'key'));
});
test('relative document paths resolve within repository', () => {
  assert.equal(
    resolvePath('docs/agents/README.md', '../fe/node.md'),
    'docs/fe/node.md',
  );
});
test('repository requests pin content to commit, authenticate and do not cache', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([url, options]);
    return {
      ok: true,
      json: async () =>
        url.endsWith('/tech')
          ? { default_branch: 'main' }
          : url.includes('/git/ref/')
            ? { object: { sha: 'commit123' } }
            : {
                tree: [
                  { type: 'blob', path: 'docs/a.md' },
                  { type: 'blob', path: '.env' },
                  { type: 'blob', path: 'tools/README.md' },
                  { type: 'blob', path: 'infra/README.md' },
                  { type: 'blob', path: 'examples/README.md' },
                ],
              },
      text: async () => '# hello',
    };
  };
  try {
    const repo = new Repository({ owner: 'user', repo: 'tech' }, 'fake');
    assert.equal((await repo.list()).length, 1);
    assert.equal(calls[0][0], 'https://api.github.com/repos/user/tech');
    await repo.file('docs/a.md');
    assert.match(calls.at(-1)[0], /ref=commit123/);
    assert.equal(calls.at(-1)[1].headers.Authorization, 'Bearer fake');
    assert.equal(calls.at(-1)[1].cache, 'no-store');
    repo.close();
    assert.equal(repo.token, '');
    assert.equal(repo.controller.signal.aborted, true);
  } finally {
    globalThis.fetch = original;
  }
});
test('API errors are actionable and do not expose credentials', async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [401, 403, 404, 500]) {
      globalThis.fetch = async () => ({ ok: false, status });
      const repo = new Repository(
        { owner: 'user', repo: 'tech' },
        'secret-token',
      );
      await assert.rejects(
        repo.request(''),
        (error) =>
          !error.message.includes('secret-token') &&
          /失效|拒绝|不存在|失败|无法访问/.test(error.message),
      );
    }
  } finally {
    globalThis.fetch = original;
  }
});
