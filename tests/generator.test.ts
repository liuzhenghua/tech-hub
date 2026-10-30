import { generateRSA } from '../src/tools/generator/rsa';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPrivateKey,
  createPublicKey,
  publicEncrypt,
  privateDecrypt,
} from 'node:crypto';
import {
  generateUUIDs,
  generateKey,
  generatePassword,
  passwordGroups,
} from '../src/tools/generator/generate';

test('UUIDs use v4 version and variant bits with independent formatting options', () => {
  const uuids = generateUUIDs(12, true, false).split('\n');
  for (const uuid of uuids)
    assert.match(
      uuid,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  assert.equal(new Set(uuids).size, 12);
  assert.match(
    generateUUIDs(1, false, true),
    /^[0-9A-F]{12}4[0-9A-F]{3}[89AB][0-9A-F]{15}$/,
  );
  for (const count of [0, 101, 1.5, NaN])
    assert.throws(() => generateUUIDs(count, true, false));
});
test('random key length means decoded bytes in both output encodings', () => {
  for (const length of [1, 16, 24, 32, 4096]) {
    const hex = generateKey(length, 'Hex');
    const base64 = generateKey(length, 'Base64');
    assert.match(hex, /^[a-f0-9]+$/);
    assert.equal(hex.length, length * 2);
    assert.equal(Buffer.from(base64, 'base64').length, length);
  }
  for (const length of [0, 4097, 1.2, Infinity])
    assert.throws(() => generateKey(length, 'Hex'));
  assert.throws(() => generateKey(32, 'UTF-8'));
});
test('passwords respect selected character classes and bounds', () => {
  const groups = Object.values(passwordGroups);
  for (const length of [8, 20, 256]) {
    const value = generatePassword(length, groups);
    assert.equal(value.length, length);
    for (const group of groups)
      assert.ok([...value].some((char) => group.includes(char)));
  }
  assert.match(generatePassword(32, [passwordGroups.digits]), /^\d{32}$/);
  assert.throws(() => generatePassword(20, []));
  assert.throws(() => generatePassword(20, ['unknown']));
  assert.throws(() => generatePassword(7, groups));
  assert.throws(() => generatePassword(257, groups));
});
test('password sampling rejects bytes outside the uniform range', (context) => {
  context.mock.method(crypto, 'getRandomValues', (bytes: Uint8Array) => {
    bytes.fill(0);
    bytes[0] = 255;
    return bytes;
  });
  assert.equal(generatePassword(8, [passwordGroups.lower]), 'aaaaaaaa');
});
test('RSA PEM keys form an interoperable key pair', async () => {
  const result = await generateRSA(2048);
  assert.match(result.publicKey, /^-----BEGIN PUBLIC KEY-----\n/);
  assert.match(result.privateKey, /^-----BEGIN PRIVATE KEY-----\n/);
  const privateKey = createPrivateKey(result.privateKey);
  const publicKey = createPublicKey(result.publicKey);
  assert.equal(publicKey.asymmetricKeyDetails?.modulusLength, 2048);
  assert.equal(publicKey.asymmetricKeyDetails?.publicExponent, 65537n);
  assert.deepEqual(
    createPublicKey(privateKey).export({ type: 'spki', format: 'der' }),
    publicKey.export({ type: 'spki', format: 'der' }),
  );
  const plaintext = Buffer.from('生成器 RSA round trip');
  const encrypted = publicEncrypt(
    { key: publicKey, oaepHash: 'sha256' },
    plaintext,
  );
  assert.deepEqual(
    privateDecrypt({ key: privateKey, oaepHash: 'sha256' }, encrypted),
    plaintext,
  );
  await assert.rejects(generateRSA(1024));
});

test('PKCS#1 PEM exports a matching, usable RSA key pair', async () => {
  const result = await generateRSA(2048, 'pkcs1');
  assert.match(result.publicKey, /^-----BEGIN RSA PUBLIC KEY-----\n/);
  assert.match(result.privateKey, /^-----BEGIN RSA PRIVATE KEY-----\n/);
  const publicKey = createPublicKey(result.publicKey);
  const privateKey = createPrivateKey(result.privateKey);
  assert.deepEqual(
    createPublicKey(privateKey).export({ type: 'spki', format: 'der' }),
    publicKey.export({ type: 'spki', format: 'der' }),
  );
  const plain = Buffer.from('PKCS#1 format round trip');
  assert.deepEqual(
    privateDecrypt(
      { key: privateKey, oaepHash: 'sha256' },
      publicEncrypt({ key: publicKey, oaepHash: 'sha256' }, plain),
    ),
    plain,
  );
});
test('JWK exports only appropriate public or private material and supports algorithm selection on import', async () => {
  const result = await generateRSA(2048, 'jwk');
  const publicJWK = JSON.parse(result.publicKey);
  const privateJWK = JSON.parse(result.privateKey);
  assert.deepEqual(Object.keys(publicJWK).sort(), ['e', 'kty', 'n']);
  assert.equal(publicJWK.kty, 'RSA');
  assert.equal(publicJWK.n, privateJWK.n);
  assert.equal(publicJWK.e, privateJWK.e);
  for (const field of ['d', 'p', 'q', 'dp', 'dq', 'qi'])
    assert.equal(typeof privateJWK[field], 'string');
  assert.equal(privateJWK.alg, undefined);
  const algorithm = { name: 'RSA-PSS', hash: 'SHA-256' };
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    publicJWK,
    algorithm,
    false,
    ['verify'],
  );
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateJWK,
    algorithm,
    false,
    ['sign'],
  );
  const plain = new TextEncoder().encode('JWK signing round trip');
  const parameters = { name: 'RSA-PSS', saltLength: 32 };
  const signature = await crypto.subtle.sign(parameters, privateKey, plain);
  assert.equal(
    await crypto.subtle.verify(parameters, publicKey, signature, plain),
    true,
  );
  await assert.rejects(generateRSA(2048, 'unknown'));
});
