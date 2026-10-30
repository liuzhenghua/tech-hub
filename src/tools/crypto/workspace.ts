import digestMarkup from '../digest/editor-panel.html?raw';
import cryptoMarkup from './editor-panel.html?raw';
import { tool as digestTool } from '../digest/tool';
import { tool as cryptoTool } from './tool';
import { mountEditor } from '../shared/editor';
import { mountToolWorkspace } from '../shared/workspace';
import type { ToolDefinition } from '../shared/types';
import { mountGenerator } from '../generator/panel';
import { mountEncoding } from '../encoding/panel';

function mountPanel(root: HTMLElement, markup: string, tool: ToolDefinition) {
  root.innerHTML = markup;
  return mountEditor(root, tool);
}
export function mountCryptoWorkspace(root: HTMLElement): () => void {
  return mountToolWorkspace(
    root,
    {
      encoding: { title: '编码转换', mount: mountEncoding },
      digest: {
        title: digestTool.title,
        mount: (root) => mountPanel(root, digestMarkup, digestTool),
      },
      crypto: {
        title: cryptoTool.title,
        mount: (root) => mountPanel(root, cryptoMarkup, cryptoTool),
      },
      generator: { title: '生成器', mount: mountGenerator },
    },
    'crypto',
  );
}
