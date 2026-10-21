import type { ToolDefinition } from '../shared/types';
export const tool: ToolDefinition = {
  id: 'markdown',
  title: 'Markdown 预览',
  options: [],
  markdown: true,
  hint: '实时预览 · 代码高亮 · Mermaid 图表 · HTML 源码',
  actions: () => [],
  run: ({ value }) => ({ output: value }),
};
