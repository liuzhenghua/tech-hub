import CryptoJS from 'crypto-js';
import smCrypto from 'sm-crypto';
import { encoder, encodeBytes } from '../shared/bytes';
import { hmacTransform } from './hmac';
import type { CryptoParameters } from '../shared/types';
export async function digest(
  value: string,
  algorithm: string,
  params: CryptoParameters,
): Promise<string> {
  if (algorithm === 'MD5')
    return CryptoJS.MD5(CryptoJS.enc.Utf8.parse(value)).toString();
  if (algorithm === 'SM3') return smCrypto.sm3(value);
  if (algorithm.startsWith('HMAC-'))
    return hmacTransform(algorithm, value, params);
  return encodeBytes(
    new Uint8Array(
      await crypto.subtle.digest(algorithm, encoder.encode(value)),
    ),
    'Hex',
  );
}
