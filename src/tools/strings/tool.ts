import type { ToolDefinition } from '../shared/types';
import { transformString } from './transform';
export const tool: ToolDefinition = {
  id: 'strings',
  reuseOutput: true,
  title: '字符串处理',
  options: ['Base64', '转义', '引号转换'],
  optionLabel: '转换类型',
  hint: (option) =>
    option === 'Base64'
      ? '文本与标准 Base64 互转，按 UTF-8 编解码。'
      : option === '转义'
        ? '处理换行、Tab、双引号与反斜杠；转义不添加外层引号。'
        : '将单引号字符串改为双引号字符串；不校验或修复 JSON。',
  actions: (option) =>
    option === 'Base64'
      ? [
          { label: '编码', id: 'base64-encode' },
          { label: '解码', id: 'base64-decode' },
        ]
      : option === '转义'
        ? [
            { label: '转义', id: 'escape' },
            { label: '反转义', id: 'unescape' },
          ]
        : [{ label: '单引号转双引号', id: 'quotes' }],
  run: ({ value, action }) => ({ output: transformString(value, action) }),
};
