import { mountWorkspace } from '../workspace';

const dispose = mountWorkspace(document.querySelector<HTMLElement>('main')!);
if (import.meta.hot) import.meta.hot.dispose(dispose);
