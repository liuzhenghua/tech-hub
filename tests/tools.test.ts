import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { formatJSON } from '../src/tools/json/transform';
import { transformString } from '../src/tools/strings/transform';
import { digest } from '../src/tools/digest/transform';
import { parseJWT } from '../src/tools/jwt/transform';
import { transformCipher } from '../src/tools/crypto/transform';
import type { CryptoParameters } from '../src/tools/shared/types';
const defaults: CryptoParameters = {
  key: '00'.repeat(32),
  keyFormat: 'Hex',
  iv: '00'.repeat(12),
  format: 'Base64',
  rsaKey: '',
  rsaFormat: 'Base64',
  sm2Key: '',
  sm2Format: 'Hex',
  sm2Prefix: 'yes',
};
test('JSON strict format, repair and large-number strings', () => {
  assert.equal(
    formatJSON('{"id":"9007199254740993"}', 'minify', '2'),
    '{"id":"9007199254740993"}',
  );
  assert.equal(
    JSON.parse(formatJSON('{"text":"a\nb"}', 'repair', '2')).text,
    'a\nb',
  );
  assert.throws(() => formatJSON('{"text":"a\nb"}', 'format', '2'));
});
test('strings preserve Unicode and only supported escape sequences', () => {
  const text = '中文 😀\n"\\';
  assert.equal(
    transformString(transformString(text, 'base64-encode'), 'base64-decode'),
    text,
  );
  assert.equal(
    transformString(transformString(text, 'escape'), 'unescape'),
    text,
  );
  assert.equal(
    transformString("{'hello':'world'}", 'quotes'),
    '{"hello":"world"}',
  );
  assert.throws(() => transformString('bad', 'unsupported'));
});
test('digest known vectors and keyed authentication', async () => {
  assert.equal(
    await digest('abc', 'SHA-256', defaults),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  assert.equal(
    await digest('abc', 'MD5', defaults),
    '900150983cd24fb0d6963f7d28e17f72',
  );
  assert.equal(
    await digest('abc', 'SM3', defaults),
    '66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0',
  );
  assert.equal(
    await digest('abc', 'HMAC-SHA-256', {
      ...defaults,
      key: 'key',
      keyFormat: 'UTF-8',
      format: 'Hex',
    }),
    createHmac('sha256', 'key').update('abc').digest('hex'),
  );
});
test('JWT verifies signatures and rejects tampering and unsupported headers', async () => {
  const parts = [
    Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: 'test', iat: 0 })).toString('base64url'),
  ];
  const signature = createHmac('sha256', 'secret')
    .update(parts.join('.'))
    .digest('base64url');
  const result = await parseJWT(
    parts.join('.') + '.' + signature,
    true,
    'secret',
  );
  assert.match(result.info, /成功/);
  assert.match(
    (await parseJWT(parts.join('.') + '.' + signature, true, 'wrong')).info,
    /失败/,
  );
  await assert.rejects(parseJWT('bad', false, ''));
  await assert.rejects(
    parseJWT(
      Buffer.from('{"alg":"none"}').toString('base64url') + '.e30.',
      true,
      'secret',
    ),
  );
});
test('AES modes round-trip UTF-8; GCM rejects tampering', async () => {
  for (const mode of ['GCM', 'CBC', 'CTR', 'ECB']) {
    const params = { ...defaults, iv: '00'.repeat(mode === 'GCM' ? 12 : 16) };
    const cipher = await transformCipher(
      'AES-' + mode,
      'encrypt',
      '中文 🔐',
      params,
    );
    assert.equal(
      await transformCipher('AES-' + mode, 'decrypt', cipher, params),
      '中文 🔐',
    );
    if (mode === 'GCM')
      await assert.rejects(
        transformCipher(
          'AES-GCM',
          'decrypt',
          cipher.slice(0, -4) + 'AAAA',
          params,
        ),
      );
  }
});
test('SM4, DES and 3DES compatibility modes round-trip', async () => {
  for (const family of ['SM4', 'DES', '3DES'])
    for (const mode of ['CBC', 'ECB']) {
      const params = {
        ...defaults,
        key: '01'.repeat(family === 'SM4' ? 16 : family === 'DES' ? 8 : 24),
        iv: '00'.repeat(family === 'SM4' ? 16 : 8),
      };
      const algorithm = family + '-' + mode;
      const cipher = await transformCipher(
        algorithm,
        'encrypt',
        'compatibility 测试',
        params,
      );
      assert.equal(
        await transformCipher(algorithm, 'decrypt', cipher, params),
        'compatibility 测试',
      );
    }
});
test('RSA OAEP and PKCS1 preserve text across public/private operations', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  for (const algorithm of ['RSA-OAEP-SHA-256', 'RSA-PKCS1-v1_5']) {
    const cipher = await transformCipher(algorithm, 'encrypt', 'RSA test', {
      ...defaults,
      rsaKey: publicKey,
    });
    assert.equal(
      await transformCipher(algorithm, 'decrypt', cipher, {
        ...defaults,
        rsaKey: privateKey,
      }),
      'RSA test',
    );
  }
});

test('SM2 encryption variants preserve Unicode', async () => {
  const { default: smCrypto } = await import('sm-crypto');
  const keys = smCrypto.sm2.generateKeyPairHex();
  for (const algorithm of ['SM2-C1C3C2', 'SM2-C1C2C3']) {
    const cipher = await transformCipher(algorithm, 'encrypt', '国密 测试', {
      ...defaults,
      sm2Key: keys.publicKey,
    });
    assert.equal(
      await transformCipher(algorithm, 'decrypt', cipher, {
        ...defaults,
        sm2Key: keys.privateKey,
      }),
      '国密 测试',
    );
  }
});
