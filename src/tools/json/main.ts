import { mountEditor } from '../shared/editor';
import { mountJSONControls } from './editor-controls';
import { tool } from './tool';
const dispose = mountEditor(document.querySelector('main')!, tool);
const disposeControls = mountJSONControls(document.querySelector('main')!);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    disposeControls();
    dispose();
  });
