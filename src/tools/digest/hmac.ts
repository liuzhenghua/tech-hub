import CryptoJS from 'crypto-js';
import smCrypto from 'sm-crypto';
import { encoder, encodeBytes, decodeBytes } from '../shared/bytes';
import type { CryptoParameters } from '../shared/types';
export async function hmacTransform(
  name: string,
  value: string,
  params: CryptoParameters,
) {
  const bytes = decodeBytes(params.key, params.keyFormat);
  if (!bytes.length) throw new Error('请填写 HMAC 密钥');
  let result;
  if (name === 'HMAC-SM3')
    result = decodeBytes(
      smCrypto.sm3(value, { key: Array.from(bytes) }),
      'Hex',
    );
  else if (name === 'HMAC-MD5')
    result = decodeBytes(
      CryptoJS.HmacMD5(
        CryptoJS.enc.Hex.parse(encodeBytes(encoder.encode(value), 'Hex')),
        CryptoJS.enc.Hex.parse(encodeBytes(bytes, 'Hex')),
      ).toString(),
      'Hex',
    );
  else {
    const key = await crypto.subtle.importKey(
      'raw',
      bytes,
      { name: 'HMAC', hash: name.slice(5) },
      false,
      ['sign'],
    );
    result = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, encoder.encode(value)),
    );
  }
  return encodeBytes(result, params.format);
}
