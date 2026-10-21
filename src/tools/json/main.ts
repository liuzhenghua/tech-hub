import { mountEditor } from '../shared/editor';
import { tool } from './tool';
const dispose = mountEditor(document.querySelector('main')!, tool);
if (import.meta.hot) import.meta.hot.dispose(dispose);
