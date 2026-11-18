import { mountTransfer } from './panel';
import { recordUsage } from '../../tool-usage';

const dispose = mountTransfer();
recordUsage('lan-transfer', true);
if (import.meta.hot) import.meta.hot.dispose(dispose);
