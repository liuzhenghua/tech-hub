import smCrypto from 'sm-crypto';
import { decoder, encodeBytes, decodeBytes } from '../shared/bytes';
import type { CryptoParameters, CipherAction } from '../shared/types';
export function sm2Transform(
  name: string,
  action: CipherAction,
  value: string,
  params: CryptoParameters,
) {
  const key = params.sm2Key.replace(/\s/g, ''),
    mode = name === 'SM2-C1C3C2' ? 1 : 0;
  if (action === 'encrypt') {
    if (!value) throw new Error('SM2 暂不支持空文本');
    if (
      !/^(?:04[0-9a-f]{128}|0[23][0-9a-f]{64})$/i.test(key) ||
      !(
        smCrypto.sm2 as typeof smCrypto.sm2 & {
          verifyPublicKey: (value: string) => boolean;
        }
      ).verifyPublicKey(key)
    )
      throw new Error('请输入有效 SM2 Hex 公钥');
    const encrypted = smCrypto.sm2.doEncrypt(value, key, mode);
    return encodeBytes(
      decodeBytes((params.sm2Prefix === 'yes' ? '04' : '') + encrypted, 'Hex'),
      params.sm2Format,
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(key) || /^0+$/.test(key))
    throw new Error('SM2 私钥需要 64 位 Hex');
  let cipher = encodeBytes(decodeBytes(value, params.sm2Format), 'Hex');
  if (params.sm2Prefix === 'yes') {
    if (!cipher.startsWith('04')) throw new Error('密文缺少 04 前缀');
    cipher = cipher.slice(2);
  }
  if (cipher.length < 192) throw new Error('SM2 密文过短');
  const plain = smCrypto.sm2.doDecrypt(cipher, key, mode, { output: 'array' });
  if (!plain || !plain.length)
    throw new Error('SM2 解密失败，请检查私钥、密文顺序和 04 前缀');
  return decoder.decode(Uint8Array.from(plain));
}
