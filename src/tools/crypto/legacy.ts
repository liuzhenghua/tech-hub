import CryptoJS from 'crypto-js';
import smCrypto from 'sm-crypto';
import { encoder, decoder, encodeBytes, decodeBytes } from '../shared/bytes';
import type { CryptoParameters, CipherAction } from '../shared/types';
function unpad(bytes: Uint8Array, block: number) {
  const n = bytes[bytes.length - 1];
  if (
    !n ||
    n > block ||
    n > bytes.length ||
    !bytes.subarray(bytes.length - n).every((b) => b === n)
  )
    throw new Error('填充校验失败，请检查密钥和密文');
  return bytes.subarray(0, bytes.length - n);
}
export function legacyTransform(
  name: string,
  action: CipherAction,
  value: string,
  params: CryptoParameters,
) {
  const family = name.split('-')[0],
    cbc = name.endsWith('CBC'),
    size = family === 'SM4' ? 16 : 8,
    key = decodeBytes(params.key, params.keyFormat),
    iv = cbc ? decodeBytes(params.iv, 'Hex') : new Uint8Array();
  if (
    !(family === 'SM4'
      ? key.length === 16
      : family === 'DES'
        ? key.length === 8
        : [16, 24].includes(key.length))
  )
    throw new Error('密钥长度不符合 ' + family + ' 要求');
  if (cbc && iv.length !== size)
    throw new Error('CBC IV 必须是 ' + size + ' 字节');
  let data =
    action === 'encrypt'
      ? encoder.encode(value)
      : decodeBytes(value, params.format);
  if (action === 'encrypt') {
    const padding = size - (data.length % size),
      padded = new Uint8Array(data.length + padding);
    padded.set(data);
    padded.fill(padding, data.length);
    data = padded;
  } else if (!data.length || data.length % size)
    throw new Error('密文长度必须是块大小的整数倍');
  let result;
  if (family === 'SM4') {
    const options = {
      padding: 'none' as const,
      output: 'array' as const,
      ...(cbc ? { mode: 'cbc' as const, iv: Array.from(iv) } : {}),
    };
    result = Uint8Array.from(
      smCrypto.sm4[action](Array.from(data), Array.from(key), options),
    );
  } else {
    const algorithm = family === 'DES' ? CryptoJS.DES : CryptoJS.TripleDES,
      options = {
        mode: cbc ? CryptoJS.mode.CBC : CryptoJS.mode.ECB,
        padding: CryptoJS.pad.NoPadding,
        iv: CryptoJS.enc.Hex.parse(encodeBytes(iv, 'Hex')),
      },
      word = CryptoJS.enc.Hex.parse(encodeBytes(data, 'Hex')),
      keyWord = CryptoJS.enc.Hex.parse(encodeBytes(key, 'Hex'));
    const output =
      action === 'encrypt'
        ? algorithm.encrypt(word, keyWord, options).ciphertext
        : algorithm.decrypt(
            CryptoJS.lib.CipherParams.create({ ciphertext: word }),
            keyWord,
            options,
          );
    result = decodeBytes(output.toString(), 'Hex');
  }
  return action === 'encrypt'
    ? encodeBytes(result, params.format)
    : decoder.decode(unpad(result, size));
}
