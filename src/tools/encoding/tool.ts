import type { ToolDefinition } from '../shared/types';
import { transformEncoding } from './transform';

const hints: Record<string, string> = {
  Base64:
    '文本与标准 Base64 互转，使用 UTF-8；解码内容必须为有效的 UTF-8 文本。',
  Hex: '文本按 UTF-8 转为十六进制；解码允许空白分隔，必须为完整字节和有效 UTF-8 文本。',
  URL: '使用 encodeURIComponent / decodeURIComponent，适合 URL 参数值；加号保持原样，不按空格处理。',
};
export const tool: ToolDefinition = {
  id: 'encoding',
  title: '编码转换',
  options: ['Base64', 'Hex', 'URL'],
  optionLabel: '编码类型',
  separateOptionState: true,
  reuseOutput: true,
  inputPlaceholder: '输入需要编码或解码的文本…',
  hint: (option) => hints[option],
  actions: () => [
    { label: '编码', id: 'encode' },
    { label: '解码', id: 'decode' },
  ],
  run: ({ value, option, action }) => ({
    output: transformEncoding(value, option, action),
  }),
};
