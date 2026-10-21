import type { ToolDefinition } from '../shared/types';
import { transformCipher } from './transform';
const variants: Record<string, string[]> = {
  AES: ['AES-GCM', 'AES-CBC', 'AES-CTR', 'AES-ECB'],
  RSA: [
    'RSA-OAEP-SHA-256',
    'RSA-OAEP-SHA-1',
    'RSA-OAEP-SHA-384',
    'RSA-OAEP-SHA-512',
    'RSA-PKCS1-v1_5',
  ],
  国密: ['SM4-CBC', 'SM4-ECB', 'SM2-C1C3C2', 'SM2-C1C2C3'],
  DES: ['3DES-CBC', '3DES-ECB', 'DES-CBC', 'DES-ECB'],
};
export const tool: ToolDefinition = {
  id: 'crypto',
  reuseOutput: true,
  title: '加解密工具',
  options: Object.keys(variants),
  optionLabel: '算法',
  hint: (_option, algorithm) => {
    if (algorithm.startsWith('RSA'))
      return '加密使用公钥，解密使用私钥；支持 PEM 或 JWK。密文编码需与解密输入一致。';
    if (algorithm.startsWith('SM2'))
      return '加密填写 Hex 公钥，解密填写 Hex 私钥；C1C2C3 / C1C3C2 与 C1 前缀需与对端一致。';
    if (algorithm === 'AES-GCM')
      return 'IV 为 12 字节（Hex）；同一密钥不可重复使用 IV。密文包含认证标签。';
    if (algorithm === 'AES-CTR')
      return 'Counter 为 16 字节（Hex）；同一密钥不可重复使用 Counter。';
    if (
      algorithm.endsWith('ECB') ||
      algorithm.startsWith('DES') ||
      algorithm.startsWith('3DES')
    )
      return 'ECB 和 DES / 3DES 用于兼容旧系统；密钥、模式与密文编码需与对端一致。';
    return 'IV 为 16 字节（Hex）；使用 PKCS#7 填充，密文编码需与解密输入一致。';
  },
  variants: (option) => variants[option] || [],
  actions: () => [
    { label: '加密', id: 'encrypt' },
    { label: '解密', id: 'decrypt' },
  ],
  run: async ({ value, action, variant, parameters }) => {
    if (action !== 'encrypt' && action !== 'decrypt')
      throw Error('未知加解密操作');
    return {
      output: await transformCipher(variant, action, value, parameters),
    };
  },
};
