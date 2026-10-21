import { mountEditor } from '../shared/editor';
import { tool } from './tool';
import { mountPreviewExpansion } from './preview-expansion';
const dispose = mountEditor(document.querySelector('main')!, tool);
const disposeExpansion = mountPreviewExpansion(document.querySelector('main')!);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    disposeExpansion();
    dispose();
  });
