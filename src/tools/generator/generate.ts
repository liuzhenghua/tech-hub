import { encodeBytes } from '../shared/bytes';

function integer(
  value: number,
  min: number,
  max: number,
  label: string,
): number {
  if (!Number.isInteger(value) || value < min || value > max)
    throw Error(`${label}必须是 ${min}–${max} 之间的整数`);
  return value;
}
export function generateUUIDs(
  count: number,
  hyphens: boolean,
  uppercase: boolean,
): string {
  integer(count, 1, 100, '生成数量');
  return Array.from({ length: count }, () => {
    let value: string = crypto.randomUUID();
    if (!hyphens) value = value.replaceAll('-', '');
    return uppercase ? value.toUpperCase() : value;
  }).join('\n');
}
export function generateKey(bytes: number, encoding: string): string {
  integer(bytes, 1, 4096, '密钥字节数');
  if (encoding !== 'Hex' && encoding !== 'Base64')
    throw Error('不支持的密钥编码');
  return encodeBytes(crypto.getRandomValues(new Uint8Array(bytes)), encoding);
}
export const passwordGroups = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{}:,.?',
};
function randomText(length: number, alphabet: string): string {
  const limit = 256 - (256 % alphabet.length);
  let result = '';
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const byte of bytes) {
      if (byte < limit && result.length < length)
        result += alphabet[byte % alphabet.length];
    }
  }
  return result;
}
export function generatePassword(length: number, groups: string[]): string {
  integer(length, 8, 256, '密码长度');
  if (
    !groups.length ||
    groups.some((group) => !Object.values(passwordGroups).includes(group))
  )
    throw Error('请至少选择一种有效字符类型');
  const alphabet = [...new Set(groups.join(''))].join('');
  let value: string;
  // Reject out-of-range bytes and whole candidates to avoid modulo and composition bias.
  do {
    value = randomText(length, alphabet);
  } while (
    !groups.every((group) => [...value].some((char) => group.includes(char)))
  );
  return value;
}
