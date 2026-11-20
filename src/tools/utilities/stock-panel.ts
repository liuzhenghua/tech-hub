import markup from './stock-panel.html?raw';
import { element } from './ui';
import {
  estimateStock,
  readStockRecords,
  writeStockRecords,
  type StockPosition,
} from './stock';

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
const fields = ['amount', 'buy', 'shares', 'current'] as const;

function format(value: number, formatter: Intl.NumberFormat, unit = '') {
  return Number.isFinite(value) ? formatter.format(value + 0) + unit : '—';
}

function recordLabel(position: StockPosition) {
  const { buy, shares, current } = position;
  const { cost } = estimateStock(position);
  return [
    Number.isFinite(cost) ? `买入总额 ${money.format(cost)} 元` : '',
    buy === null ? '' : `买入价 ${buy} 元`,
    shares === null ? '' : `${shares} 股`,
    current === null ? '' : `当前价 ${current} 元`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function mountStock(root: HTMLElement): () => void {
  root.innerHTML = markup;
  const inputs = fields.map((field) =>
    element<HTMLInputElement>(root, `stock-${field}`),
  );
  const [amountInput, buyInput, sharesInput, currentInput] = inputs;
  const costOutput = element(root, 'stock-cost');
  const rateOutput = element(root, 'stock-rate');
  const profitOutput = element(root, 'stock-profit');
  const valueOutput = element(root, 'stock-value');
  const status = element(root, 'stock-status');
  const list = element(root, 'stock-records');
  const add = element<HTMLButtonElement>(root, 'stock-add');
  const events = new AbortController();
  const listeners = { signal: events.signal };

  function position(): StockPosition {
    const number = (input: HTMLInputElement) =>
      Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : null;
    return {
      amount: number(amountInput),
      buy: number(buyInput),
      shares: number(sharesInput),
      current: number(currentInput),
    };
  }

  function update() {
    const draft = position();
    const invalid =
      inputs.some((input) => !input.validity.valid) || draft.buy === 0;
    const result = invalid
      ? { cost: NaN, rate: NaN, profit: NaN, value: NaN }
      : estimateStock(draft);
    costOutput.textContent = format(result.cost, money, ' 元');
    rateOutput.textContent = format(result.rate, percent);
    profitOutput.textContent = format(result.profit, profit, ' 元');
    valueOutput.textContent = format(result.value, money, ' 元');
    add.disabled = invalid || !(draft.amount || draft.shares);
    status.textContent = invalid
      ? '买入价须大于 0，股数须为正整数，投入金额和当前价须为非负数字。'
      : '';
  }

  function renderRecords() {
    const records = readStockRecords();
    const rows = records.map((record) => {
      const row = document.createElement('div');
      row.className = 'stock-record';
      const load = document.createElement('button');
      load.type = 'button';
      load.className = 'utility-secondary';
      load.dataset.stockLoad = record.id;
      load.textContent = recordLabel(record);
      const sell = document.createElement('button');
      sell.type = 'button';
      sell.dataset.stockSell = record.id;
      sell.textContent = '卖出';
      sell.setAttribute('aria-label', `卖出并移除：${load.textContent}`);
      row.append(load, sell);
      return row;
    });
    const empty = document.createElement('p');
    empty.className = 'utility-hint';
    empty.textContent = '暂无成交记录';
    list.replaceChildren(...(rows.length ? rows : [empty]));
  }

  add.addEventListener(
    'click',
    () => {
      const records = readStockRecords();
      const saved = writeStockRecords([
        { id: crypto.randomUUID(), ...position() },
        ...records,
      ]);
      if (saved) renderRecords();
      status.textContent = saved
        ? '已添加成交记录'
        : '无法保存成交记录，请检查浏览器存储设置。';
    },
    listeners,
  );

  list.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof HTMLButtonElement)) return;
      const { stockLoad, stockSell } = event.target.dataset;
      const records = readStockRecords();
      const record = records.find(({ id }) => id === (stockLoad ?? stockSell));
      if (!record) return;
      if (stockLoad) {
        fields.forEach((field, index) => {
          inputs[index].value = record[field]?.toString() ?? '';
        });
        update();
        status.textContent = '已回填成交记录';
        currentInput.focus();
        return;
      }
      const saved = writeStockRecords(
        records.filter(({ id }) => id !== stockSell),
      );
      if (saved) {
        renderRecords();
        (list.querySelector('button') ?? add).focus();
      }
      status.textContent = saved
        ? '已卖出并移除成交记录'
        : '无法移除成交记录，请检查浏览器存储设置。';
    },
    listeners,
  );

  root.addEventListener('input', update, listeners);
  window.addEventListener('storage', renderRecords, listeners);
  update();
  renderRecords();
  return () => events.abort();
}
