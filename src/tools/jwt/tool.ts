import type { ToolDefinition } from '../shared/types';
import { parseJWT } from './transform';
export const tool: ToolDefinition = {
  id: 'jwt',
  title: 'JWT 解析',
  options: [],
  autoAction: 'parse',
  hint: '解析无需密钥。签名校验不检查有效期、签发者或受众。',
  actions: () => [{ label: '校验签名', id: 'verify' }],
  run: ({ value, action, jwtKey }) =>
    parseJWT(value, action === 'verify', jwtKey),
};
