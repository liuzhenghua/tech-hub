import { mountCryptoWorkspace } from './workspace';

const dispose = mountCryptoWorkspace(
  document.querySelector<HTMLElement>('main')!,
);
if (import.meta.hot) import.meta.hot.dispose(dispose);
