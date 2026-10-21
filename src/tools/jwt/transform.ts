import { decoder, encoder, fromBase64 } from '../shared/bytes';
async function verifyJWT(
  parts: string[],
  header: Record<string, unknown>,
  keyMaterial: string,
) {
  const expected = header.alg;
  if (
    typeof expected !== 'string' ||
    !/^(?:HS|RS|PS|ES)(?:256|384|512)$/.test(expected)
  )
    throw new Error('不支持的签名算法：' + String(expected));
  if (!globalThis.crypto?.subtle)
    throw new Error('当前环境不支持 Web Crypto，请使用现代浏览器。');
  if (header.crit !== undefined || header.b64 === false)
    throw new Error('不支持含 crit 或未编码 Payload 的 JWT。');
  if (!parts[2]) throw new Error('Token 没有签名。');
  if (!keyMaterial) throw new Error('请填写校验密钥。');
  const family = expected.slice(0, 2),
    bits = Number(expected.slice(2)),
    hash = 'SHA-' + bits;
  const name =
    family === 'HS'
      ? 'HMAC'
      : family === 'RS'
        ? 'RSASSA-PKCS1-v1_5'
        : family === 'PS'
          ? 'RSA-PSS'
          : family === 'ES'
            ? 'ECDSA'
            : null;
  if (!name) throw new Error('不支持该签名算法。');
  const algorithm =
    name === 'ECDSA'
      ? { name, namedCurve: { 256: 'P-256', 384: 'P-384', 512: 'P-521' }[bits] }
      : { name, hash };
  let format, material;
  if (family === 'HS') {
    if (/-----BEGIN/.test(keyMaterial))
      throw new Error('HMAC 需要原始文本密钥，不能使用 PEM 公钥。');
    format = 'raw';
    material = encoder.encode(keyMaterial);
  } else {
    const trimmed = keyMaterial.trim();
    if (trimmed.startsWith('{')) {
      format = 'jwk';
      material = JSON.parse(trimmed);
      if (
        material.d ||
        material.k ||
        material.kty !== (family === 'ES' ? 'EC' : 'RSA')
      )
        throw new Error('请提供匹配算法的公钥 JWK。');
      if (material.alg && material.alg !== expected)
        throw new Error('JWK 算法不匹配。');
    } else {
      const match = trimmed.match(
        /^-----BEGIN PUBLIC KEY-----\s*([A-Za-z0-9+/=\s]+)\s*-----END PUBLIC KEY-----$/,
      );
      if (!match)
        throw new Error('请提供 BEGIN PUBLIC KEY 格式的 PEM 公钥或公钥 JWK。');
      format = 'spki';
      material = fromBase64(match[1]);
    }
  }
  const key =
    format === 'jwk'
      ? await crypto.subtle.importKey(
          'jwk',
          material as JsonWebKey,
          algorithm,
          false,
          ['verify'],
        )
      : await crypto.subtle.importKey(
          format as 'raw' | 'spki',
          material as BufferSource,
          algorithm,
          false,
          ['verify'],
        );
  const verification =
    name === 'ECDSA'
      ? { name, hash }
      : name === 'RSA-PSS'
        ? { name, saltLength: bits / 8 }
        : { name };
  const signature = fromBase64(parts[2].replace(/-/g, '+').replace(/_/g, '/'));
  return crypto.subtle.verify(
    verification,
    key,
    signature,
    encoder.encode(parts[0] + '.' + parts[1]),
  );
}

export async function parseJWT(
  value: string,
  verify: boolean,
  keyMaterial: string,
) {
  const parts = value
    .trim()
    .replace(/^Bearer\s+/i, '')
    .split('.');
  if (
    parts.length !== 3 ||
    !parts[0] ||
    !parts[1] ||
    !parts.every((part) => /^[A-Za-z0-9_-]*$/.test(part))
  )
    throw Error('请输入三段式 JWT。');
  const decode = (part: string): Record<string, unknown> => {
    const object: unknown = JSON.parse(
      decoder.decode(fromBase64(part.replace(/-/g, '+').replace(/_/g, '/'))),
    );
    if (!object || typeof object !== 'object' || Array.isArray(object))
      throw Error('JWT Header 和 Payload 必须为对象');
    return object as Record<string, unknown>;
  };
  const header = decode(parts[0]),
    payload = decode(parts[1]);
  const times = Object.entries(payload)
    .filter(([key]) => ['iat', 'nbf', 'exp'].includes(key))
    .map(
      ([key, time]) =>
        `${key}: ${typeof time === 'number' && Number.isFinite(time) && Math.abs(time) < 8.64e12 ? new Date(time * 1000).toISOString() : '无效时间'}`,
    );
  const valid = verify ? await verifyJWT(parts, header, keyMaterial) : null;
  return {
    output: JSON.stringify({ header, payload, signature: parts[2] }, null, 2),
    info: [
      ...(verify
        ? [
            `签名校验：${valid ? '成功' : '失败'} · ${String(header.alg)}（未检查有效期、签发者和受众）`,
          ]
        : ['仅解码，未校验签名']),
      ...times,
    ].join('\n'),
  };
}
