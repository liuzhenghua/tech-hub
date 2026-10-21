import type { ToolDefinition } from '../shared/types';
import { digest } from './transform';
export const tool: ToolDefinition = {
  id: 'digest',
  title: '摘要工具',
  options: ['SHA', 'MD5', 'SM3', 'HMAC'],
  optionLabel: '算法',
  hint: (option, variant) =>
    option === 'HMAC'
      ? '使用密钥计算消息认证码，可选择 Hex 或 Base64 结果。'
      : option === 'MD5' || variant === 'SHA-1'
        ? '按原始 UTF-8 字节计算，结果为 Hex。MD5 和 SHA-1 不适合密码存储。'
        : '按原始 UTF-8 字节计算，包含空格与换行；结果为 Hex。',
  variants: (option) =>
    option === 'SHA'
      ? ['SHA-256', 'SHA-384', 'SHA-512', 'SHA-1']
      : option === 'HMAC'
        ? [
            'HMAC-SHA-256',
            'HMAC-SHA-384',
            'HMAC-SHA-512',
            'HMAC-SHA-1',
            'HMAC-MD5',
            'HMAC-SM3',
          ]
        : [],
  actions: () => [{ label: '计算摘要', id: 'digest' }],
  run: async ({ value, option, variant, parameters }) => ({
    output: await digest(value, variant || option, parameters),
  }),
};
