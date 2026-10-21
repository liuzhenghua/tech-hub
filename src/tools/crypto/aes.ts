import CryptoJS from 'crypto-js';
import { encoder, decoder, encodeBytes, decodeBytes } from '../shared/bytes';
import type { CryptoParameters, CipherAction } from '../shared/types';
function aesECB(
  action: CipherAction,
  value: string,
  keyBytes: Uint8Array,
  format: string,
) {
  if (![16, 24, 32].includes(keyBytes.length))
    throw new Error('AES 密钥必须是 16、24 或 32 字节。');
  const key = CryptoJS.enc.Hex.parse(encodeBytes(keyBytes, 'Hex'));
  if (action === 'encrypt') {
    const data = CryptoJS.enc.Hex.parse(
      encodeBytes(encoder.encode(value), 'Hex'),
    );
    const result = CryptoJS.AES.encrypt(data, key, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    });
    return encodeBytes(
      decodeBytes(result.ciphertext.toString(CryptoJS.enc.Hex), 'Hex'),
      format,
    );
  }
  const ciphertext = decodeBytes(value, format);
  if (!ciphertext.length || ciphertext.length % 16)
    throw new Error('ECB 密文长度必须是 16 字节的整数倍。');
  const result = CryptoJS.AES.decrypt(
    CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Hex.parse(encodeBytes(ciphertext, 'Hex')),
    }),
    key,
    { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.NoPadding },
  );
  const plain = decodeBytes(result.toString(CryptoJS.enc.Hex), 'Hex'),
    padding = plain[plain.length - 1];
  if (
    padding < 1 ||
    padding > 16 ||
    !plain.subarray(plain.length - padding).every((b) => b === padding)
  )
    throw new Error('ECB 填充校验失败，请检查密钥和密文。');
  return decoder.decode(plain.subarray(0, plain.length - padding));
}
export async function aesTransform(
  name: string,
  action: CipherAction,
  value: string,
  params: CryptoParameters,
) {
  if (!crypto?.subtle) throw new Error('当前浏览器不支持 Web Crypto。');
  const keyBytes = decodeBytes(params.key, params.keyFormat);
  if (name === 'AES-ECB') return aesECB(action, value, keyBytes, params.format);
  const iv = decodeBytes(params.iv, 'Hex');
  if (![16, 24, 32].includes(keyBytes.length))
    throw new Error('AES 密钥必须是 16、24 或 32 字节。');
  if (iv.length !== (name === 'AES-GCM' ? 12 : 16))
    throw new Error(
      name === 'AES-GCM'
        ? 'GCM IV 必须是 12 字节。'
        : 'IV / Counter 必须是 16 字节。',
    );
  const algorithm =
    name === 'AES-CTR'
      ? { name, counter: iv, length: 64 }
      : name === 'AES-GCM'
        ? { name, iv, tagLength: 128 }
        : { name, iv };
  const key = await crypto.subtle.importKey('raw', keyBytes, name, false, [
    action,
  ]);
  try {
    const result = new Uint8Array(
      await crypto.subtle[action](
        algorithm,
        key,
        action === 'encrypt'
          ? encoder.encode(value)
          : decodeBytes(value, params.format),
      ),
    );
    return action === 'encrypt'
      ? encodeBytes(result, params.format)
      : decoder.decode(result);
  } catch {
    throw new Error('加解密失败，请检查密钥、IV、密文编码及 GCM Tag。');
  }
}
