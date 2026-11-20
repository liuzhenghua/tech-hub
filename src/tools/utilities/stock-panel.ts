import markup from './stock-panel.html?raw';
import { element } from './ui';

const decimals = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
const percent = new Intl.NumberFormat('zh-CN', {
  ...decimals,
  style: 'percent',
  signDisplay: 'exceptZero',
});
const profit = new Intl.NumberFormat('zh-CN', {
  ...decimals,
  signDisplay: 'exceptZero',
});
const money = new Intl.NumberFormat('zh-CN', decimals);

function format(value: number, formatter: Intl.NumberFormat, unit = '') {
  return Number.isFinite(value) ? formatter.format(value) + unit : '—';
}

export function mountStock(root: HTMLElement): () => void {
  root.innerHTML = markup;
  const amount = element<HTMLInputElement>(root, 'stock-amount');
  const buy = element<HTMLInputElement>(root, 'stock-buy');
  const current = element<HTMLInputElement>(root, 'stock-current');
  const rateOutput = element(root, 'stock-rate');
  const profitOutput = element(root, 'stock-profit');
  const valueOutput = element(root, 'stock-value');
  const status = element(root, 'stock-status');
  const events = new AbortController();

  function update() {
    const invalid =
      [amount, buy, current].some((input) => !input.validity.valid) ||
      buy.valueAsNumber === 0;
    const price = buy.valueAsNumber;
    const currentPrice = current.valueAsNumber;
    const investment = amount.valueAsNumber;
    const rate = invalid ? NaN : (currentPrice - price) / price;
    const value = invalid ? NaN : investment * (currentPrice / price);
    rateOutput.textContent = format(rate, percent);
    profitOutput.textContent = format(investment * rate, profit, ' 元');
    valueOutput.textContent = format(value, money, ' 元');
    status.textContent = invalid
      ? '买入价须大于 0，投入金额和当前价须为非负数字。'
      : '';
  }

  root.addEventListener('input', update, { signal: events.signal });
  return () => events.abort();
}
