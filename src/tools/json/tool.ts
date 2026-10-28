import type { ToolDefinition } from '../shared/types';
import { formatJSON } from './transform';
export const tool: ToolDefinition = {
  id: 'json',
  title: 'JSON 工具',
  options: ['2', '4', 'tab'],
  optionLabel: '缩进',
  hint: '修复采用启发式规则，处理后请核对内容。大整数建议使用字符串。',
  actions: () => [
    { label: '格式化', id: 'format' },
    { label: '修复并格式化', id: 'repair' },
    { label: '压缩', id: 'minify' },
  ],
  run: ({ value, action, option }) => ({
    output: formatJSON(value, action, option),
    json: true,
  }),
};
