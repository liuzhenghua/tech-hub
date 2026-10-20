import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const token = process.env.DATA_GITHUB_TOKEN?.trim(),
  secret = process.env.DATA_TOKEN_PASSPHRASE;
if (!token || !secret)
  throw Error('需要 DATA_GITHUB_TOKEN 和 DATA_TOKEN_PASSPHRASE');
const salt = randomBytes(16),
  iv = randomBytes(12),
  key = pbkdf2Sync(secret, salt, 600000, 32, 'sha256'),
  cipher = createCipheriv('aes-256-gcm', key, iv);
const ciphertext = Buffer.concat([
  cipher.update(token, 'utf8'),
  cipher.final(),
  cipher.getAuthTag(),
]);
const box = Buffer.from(
  JSON.stringify({
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: 600000,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  }),
).toString('base64url');
writeFileSync('.env.local', `VITE_GITHUB_TOKEN_BOX=${box}\n`, {
  mode: 0o600,
});
console.log(
  '密文已写入 .env.local；将 VITE_GITHUB_TOKEN_BOX 配置到 Actions Secret。',
);
