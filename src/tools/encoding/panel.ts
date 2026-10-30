import { mountEditorPanel } from '../shared/editor-panel';
import { tool } from './tool';
import { migrateBase64State } from './storage';

export function mountEncoding(root: HTMLElement): () => void {
  migrateBase64State();
  return mountEditorPanel(root, tool);
}
