import {
  encoder,
  decoder,
  fromBase64,
  encodeBytes,
  decodeBytes,
} from '../shared/bytes';

export function transformEncoding(
  value: string,
  format: string,
  action: string,
): string {
  if (action !== 'encode' && action !== 'decode') throw Error('未知编码操作');
  const encode = action === 'encode';
  switch (format) {
    case 'Base64':
      return encode
        ? encodeBytes(encoder.encode(value), 'Base64')
        : decoder.decode(fromBase64(value));
    case 'Hex':
      return encode
        ? encodeBytes(encoder.encode(value), 'Hex')
        : decoder.decode(decodeBytes(value, 'Hex'));
    case 'URL':
      return encode ? encodeURIComponent(value) : decodeURIComponent(value);
    default:
      throw Error('未知编码类型');
  }
}
