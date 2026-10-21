const bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function unlockTokenBox(encoded: string, secret: string) {
  if (!encoded) throw Error('尚未配置加密 Token，请先完成站点配置。');
  if (!secret) throw Error('请输入解密口令。');
  try {
    const s = encoded.replace(/-/g, '+').replace(/_/g, '/'),
      box = JSON.parse(atob(s.padEnd(Math.ceil(s.length / 4) * 4, '=')));
    if (
      box.version !== 1 ||
      box.kdf !== 'PBKDF2-SHA256' ||
      box.iterations !== 600000
    )
      throw Error();
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: bytes(box.salt),
        iterations: box.iterations,
      },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const token = new TextDecoder()
      .decode(
        await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: bytes(box.iv) },
          key,
          bytes(box.ciphertext),
        ),
      )
      .trim();
    if (!token) throw Error();
    return token;
  } catch {
    throw Error('解密失败：口令错误或 Token 密文损坏。');
  }
}
