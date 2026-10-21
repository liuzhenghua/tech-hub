import forge from 'node-forge';
import {
  encoder,
  decoder,
  fromBase64,
  encodeBytes,
  decodeBytes,
} from '../shared/bytes';
import type { CryptoParameters, CipherAction } from '../shared/types';
function binaryString(bytes: Uint8Array) {
  return Array.from(bytes, (b) => String.fromCharCode(b)).join('');
}
export function rsaPKCS1(
  action: CipherAction,
  value: string,
  params: CryptoParameters,
) {
  const keyText = params.rsaKey.trim();
  let key;
  if (keyText.startsWith('{')) {
    const jwk = JSON.parse(keyText);
    if (jwk.kty !== 'RSA') throw new Error('需要 RSA JWK');
    const n = forge.util
        .createBuffer(
          binaryString(fromBase64(jwk.n.replace(/-/g, '+').replace(/_/g, '/'))),
        )
        .toHex(),
      e = decodeBytesFromJWK(jwk.e);
    const big = (v: string) =>
      new forge.jsbn.BigInteger(decodeBytesFromJWK(v), 16);
    key =
      action === 'encrypt'
        ? forge.pki.setRsaPublicKey(
            new forge.jsbn.BigInteger(n, 16),
            new forge.jsbn.BigInteger(e, 16),
          )
        : forge.pki.setRsaPrivateKey(
            big(jwk.n),
            big(jwk.e),
            big(jwk.d),
            big(jwk.p),
            big(jwk.q),
            big(jwk.dp),
            big(jwk.dq),
            big(jwk.qi),
          );
  } else
    key =
      action === 'encrypt'
        ? forge.pki.publicKeyFromPem(keyText)
        : forge.pki.privateKeyFromPem(keyText);
  if (action === 'encrypt') {
    const bytes = encoder.encode(value);
    if (bytes.length > Math.ceil(key.n.bitLength() / 8) - 11)
      throw new Error('RSA PKCS#1 明文过长');
    return encodeBytes(
      Uint8Array.from(
        (key as forge.pki.rsa.PublicKey).encrypt(
          binaryString(bytes),
          'RSAES-PKCS1-V1_5',
        ),
        (c) => c.charCodeAt(0),
      ),
      params.rsaFormat,
    );
  }
  return decoder.decode(
    Uint8Array.from(
      (key as forge.pki.rsa.PrivateKey).decrypt(
        binaryString(decodeBytes(value, params.rsaFormat)),
        'RSAES-PKCS1-V1_5',
      ),
      (c) => c.charCodeAt(0),
    ),
  );
}
function decodeBytesFromJWK(value: string) {
  if (typeof value !== 'string') throw new Error('JWK 缺少密钥参数');
  return encodeBytes(
    fromBase64(value.replace(/-/g, '+').replace(/_/g, '/')),
    'Hex',
  );
}
export async function rsaTransform(
  name: string,
  action: CipherAction,
  value: string,
  params: CryptoParameters,
) {
  if (!globalThis.crypto?.subtle)
    throw new Error('当前浏览器不支持 Web Crypto。');
  const hash = name.slice('RSA-OAEP-'.length),
    text = params.rsaKey.trim();
  let format, material;
  if (text.startsWith('{')) {
    format = 'jwk';
    material = JSON.parse(text);
    if (
      material.kty !== 'RSA' ||
      (action === 'decrypt' && !material.d) ||
      (action === 'encrypt' && material.d)
    )
      throw new Error('加密需要 RSA 公钥，解密需要 RSA 私钥。');
  } else {
    const type = action === 'encrypt' ? 'PUBLIC' : 'PRIVATE',
      match = text.match(
        new RegExp(
          '^-----BEGIN ' +
            type +
            ' KEY-----([A-Za-z0-9+/=\\s]+)-----END ' +
            type +
            ' KEY-----$',
        ),
      );
    if (!match)
      throw new Error(
        '加密需要 SPKI PUBLIC KEY，解密需要 PKCS#8 PRIVATE KEY（不支持 PKCS#1 RSA PRIVATE KEY）。',
      );
    format = action === 'encrypt' ? 'spki' : 'pkcs8';
    material = fromBase64(match[1]);
  }
  try {
    const key =
      format === 'jwk'
        ? await crypto.subtle.importKey(
            'jwk',
            material as JsonWebKey,
            { name: 'RSA-OAEP', hash },
            false,
            [action],
          )
        : await crypto.subtle.importKey(
            format as 'spki' | 'pkcs8',
            material as BufferSource,
            { name: 'RSA-OAEP', hash },
            false,
            [action],
          );
    const data =
      action === 'encrypt'
        ? encoder.encode(value)
        : decodeBytes(value, params.rsaFormat);
    if (
      action === 'encrypt' &&
      data.length >
        (key.algorithm as RsaKeyAlgorithm).modulusLength / 8 -
          (2 * (hash === 'SHA-1' ? 160 : Number(hash.slice(4)))) / 8 -
          2
    )
      throw new Error('明文过长，RSA-OAEP 只适合短文本。');
    const result = new Uint8Array(
      await crypto.subtle[action]('RSA-OAEP', key, data),
    );
    return action === 'encrypt'
      ? encodeBytes(result, params.rsaFormat)
      : decoder.decode(result);
  } catch (error) {
    throw new Error(
      'RSA 操作失败：' +
        (error instanceof Error && error.name === 'OperationError'
          ? '请检查密钥、OAEP Hash 和密文编码'
          : error instanceof Error
            ? error.message
            : String(error)),
    );
  }
}
