import { encodeBytes } from '../shared/bytes';

export const rsaFormats = {
  pem: {
    label: 'PEM · SPKI / PKCS#8',
    publicLabel: '公钥 · SPKI',
    privateLabel: '私钥 · PKCS#8',
    hint: 'PEM 格式：公钥 SPKI，私钥 PKCS#8（未加密）。',
  },
  pkcs1: {
    label: 'PEM · PKCS#1',
    publicLabel: '公钥 · PKCS#1',
    privateLabel: '私钥 · PKCS#1',
    hint: '传统 RSA PEM：公私钥均为 PKCS#1，私钥未加密。此处选择密钥格式，加密填充在加解密工具中选择。',
  },
  jwk: {
    label: 'JWK · JSON',
    publicLabel: '公钥 · JWK',
    privateLabel: '私钥 · JWK',
    hint: 'JSON Web Key：使用 Base64URL 编码的 RSA 参数；私钥未加密，不绑定具体加密或签名算法。',
  },
} as const;
function pem(label: string, bytes: ArrayBuffer): string {
  const base64 = encodeBytes(new Uint8Array(bytes), 'Base64');
  return `-----BEGIN ${label}-----\n${base64.match(/.{1,64}/g)!.join('\n')}\n-----END ${label}-----`;
}
async function exportPKCS1(publicKey: ArrayBuffer, privateKey: ArrayBuffer) {
  const { default: forge } = await import('node-forge');
  const asn1 = (bytes: ArrayBuffer) =>
    forge.asn1.fromDer(String.fromCharCode(...new Uint8Array(bytes)));
  return {
    publicKey: forge.pki
      .publicKeyToRSAPublicKeyPem(forge.pki.publicKeyFromAsn1(asn1(publicKey)))
      .replaceAll('\r\n', '\n'),
    privateKey: forge.pki
      .privateKeyToPem(forge.pki.privateKeyFromAsn1(asn1(privateKey)))
      .replaceAll('\r\n', '\n'),
  };
}
async function exportJWK(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('jwk', key);
  // Keep key material portable across encryption and signature algorithms.
  const fields = ['kty', 'n', 'e', 'd', 'p', 'q', 'dp', 'dq', 'qi'] as const;
  return JSON.stringify(
    Object.fromEntries(
      fields
        .filter((field) => exported[field] !== undefined)
        .map((field) => [field, exported[field]]),
    ),
    null,
    2,
  );
}
export async function generateRSA(
  bits: number,
  format = 'pem',
): Promise<{ publicKey: string; privateKey: string }> {
  if (![2048, 3072, 4096].includes(bits))
    throw Error('RSA 长度仅支持 2048、3072、4096 位');
  if (!Object.hasOwn(rsaFormats, format)) throw Error('不支持的 RSA 输出格式');
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: bits,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );
  if (format === 'jwk') {
    const [publicKey, privateKey] = await Promise.all([
      exportJWK(pair.publicKey),
      exportJWK(pair.privateKey),
    ]);
    return { publicKey, privateKey };
  }
  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.exportKey('spki', pair.publicKey),
    crypto.subtle.exportKey('pkcs8', pair.privateKey),
  ]);
  if (format === 'pkcs1') return exportPKCS1(publicKey, privateKey);
  return {
    publicKey: pem('PUBLIC KEY', publicKey),
    privateKey: pem('PRIVATE KEY', privateKey),
  };
}
