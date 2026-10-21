import { aesTransform } from './aes';
import { rsaTransform, rsaPKCS1 } from './rsa';
import { legacyTransform } from './legacy';
import { sm2Transform } from './sm2';
import type { CryptoParameters, CipherAction } from '../shared/types';
export async function transformCipher(
  name: string,
  action: CipherAction,
  value: string,
  params: CryptoParameters,
): Promise<string> {
  if (name === 'RSA-PKCS1-v1_5') return rsaPKCS1(action, value, params);
  if (name.startsWith('SM2-')) return sm2Transform(name, action, value, params);
  if (/^(SM4|DES|3DES)-/.test(name))
    return legacyTransform(name, action, value, params);
  if (name.startsWith('RSA-OAEP-'))
    return rsaTransform(name, action, value, params);
  if (name.startsWith('AES-')) return aesTransform(name, action, value, params);
  throw Error('未知加解密算法');
}
