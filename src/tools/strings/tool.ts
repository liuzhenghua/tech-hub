import type { ToolDefinition } from '../shared/types';
import { hasStringEscapes, transformString } from './transform';
export const tool: ToolDefinition = {
  id: 'strings',
  reuseOutput: true,
  separateOptionState: true,
  title: '字符串处理',
  inputPlaceholder: '输入需要转义或转换引号的文本…',
  options: ['转义', '引号转换'],
  optionLabel: '转换类型',
  pasteAction: (value, option) =>
    option === '转义'
      ? hasStringEscapes(value)
        ? 'unescape'
        : 'escape'
      : undefined,
  hint: (option) =>
    option === '转义'
      ? '粘贴时含 \\n、\\t、\\" 或 \\\\ 自动反转义，否则自动转义；不添加外层引号。'
      : '将单引号字符串改为双引号字符串；不校验或修复 JSON。',
  actions: (option) =>
    option === '转义'
      ? [
          { label: '转义', id: 'escape' },
          { label: '反转义', id: 'unescape' },
        ]
      : [{ label: '单引号转双引号', id: 'quotes' }],
  run: ({ value, action }) => ({ output: transformString(value, action) }),
};
