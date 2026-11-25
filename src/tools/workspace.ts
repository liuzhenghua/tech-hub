import { mountEditorDrafts } from './editor-drafts';
import './editor-drafts.css';
import { tool as jsonTool } from './json/tool';
import { tool as stringsTool } from './strings/tool';
import { mountClipboard } from './clipboard/panel';
import { mountToolWorkspace } from './shared/workspace';
import './clipboard/style.css';
import { migrateBase64State } from './encoding/storage';

export function mountWorkspace(root: HTMLElement): () => void {
  migrateBase64State();
  return mountToolWorkspace(
    root,
    {
      json: {
        title: jsonTool.title,
        mount: (root) => mountEditorDrafts(root, jsonTool, 'JSON'),
      },
      strings: {
        title: stringsTool.title,
        mount: (root) => mountEditorDrafts(root, stringsTool),
      },
      clipboard: { title: '剪贴板', mount: mountClipboard },
    },
    'json',
    { generator: '../crypto/#generator' },
  );
}
