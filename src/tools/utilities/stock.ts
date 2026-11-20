export interface StockPosition {
  amount: number | null;
  buy: number | null;
  shares: number | null;
  current: number | null;
}

interface StockRecord extends StockPosition {
  id: string;
}

const storageKey = 'stock-trade-records';

export function estimateStock({ amount, buy, shares, current }: StockPosition) {
  const quantity = shares ?? (amount ?? NaN) / (buy ?? NaN);
  const basis =
    shares !== null && amount !== null ? amount / shares : (buy ?? NaN);
  const price = current ?? NaN;
  const value = quantity * price;
  const difference = price - basis;
  const profit = quantity * difference;
  const rate = basis > 0 ? difference / basis : NaN;
  const cost = amount ?? quantity * basis;
  return { cost, rate, profit, value };
}

function isRecord(value: unknown): value is StockRecord {
  if (!value || typeof value !== 'object') return false;
  const { id, amount, buy, shares, current } = value as StockRecord;
  const optionalNumber = (number: number | null, minimum: number) =>
    number === null || (Number.isFinite(number) && number >= minimum);
  return (
    typeof id === 'string' &&
    optionalNumber(amount, 0) &&
    optionalNumber(current, 0) &&
    (buy === null || (Number.isFinite(buy) && buy > 0)) &&
    (shares === null || (Number.isSafeInteger(shares) && shares > 0))
  );
}

export function readStockRecords(): StockRecord[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(saved) ? saved.filter(isRecord) : [];
  } catch {
    return [];
  }
}

export function writeStockRecords(records: StockRecord[]): boolean {
  try {
    localStorage.setItem(storageKey, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}
