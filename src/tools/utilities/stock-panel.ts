import markup from './stock-panel.html?raw';
import { element } from './ui';
import { mountOptionTabs } from '../shared/option-tabs';
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
  const mode = element<HTMLSelectElement>(root, 'stock-mode');
  const source = element<HTMLInputElement>(root, 'stock-source');
  const amountLabel = element(root, 'stock-amount-label');
  const sharesLabel = element(root, 'stock-shares-label');
  const conversion = element(root, 'stock-conversion');
  const disposeTabs = mountOptionTabs(mode);
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
      amount: source.value === 'shares' ? null : number(amountInput),
      buy: number(buyInput),
      shares: source.value === 'amount' ? null : number(sharesInput),
      current: number(currentInput),
    };
  }

  function updateConversion(draft: StockPosition) {
    const showShares = mode.value === 'shares';
    sharesLabel.hidden = sharesInput.hidden = !showShares;
    amountLabel.hidden = amountInput.hidden = showShares;
    const fromAmount = source.value === 'amount';
    const fromShares = source.value === 'shares';
    sharesInput.min = fromAmount ? '0' : '1';
    sharesInput.step = fromAmount ? 'any' : '1';
    const price = draft.buy ?? 0;
    const original = fromAmount ? draft.amount : draft.shares;
    const converted =
      price > 0 && original !== null
        ? fromAmount
          ? original / price
          : original * price
        : NaN;
    const preview = Number.isFinite(converted)
      ? String(Number(converted.toPrecision(12)))
      : '';
    if (fromAmount) sharesInput.value = preview;
    if (fromShares) amountInput.value = preview;
    const isPreview = (showShares && fromAmount) || (!showShares && fromShares);
    conversion.hidden = !isPreview || original === null;
    conversion.textContent = preview
      ? showShares
        ? '按买入总额估算，可直接修改股数。'
        : '按股数换算，可直接修改总额。'
      : '填写买入单价后即可换算。';
  }

  function update() {
    const draft = position();
    updateConversion(draft);
    const originalInputs = [
      buyInput,
      currentInput,
      ...[amountInput, sharesInput].filter(
        (input) =>
          (input === sharesInput && source.value !== 'amount') ||
          (input === amountInput && source.value !== 'shares'),
      ),
    ];
    const invalid =
      originalInputs.some((input) => !input.validity.valid) || draft.buy === 0;
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
        source.value =
          record.shares !== null && record.amount !== null
            ? 'legacy'
            : record.amount !== null
              ? 'amount'
              : 'shares';
        mode.value = record.shares !== null ? 'shares' : source.value;
        mode.dispatchEvent(new Event('change'));
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

  mode.addEventListener('change', update, listeners);
  root.addEventListener(
    'input',
    (event) => {
      if (event.target === sharesInput) source.value = 'shares';
      if (event.target === amountInput) source.value = 'amount';
      update();
    },
    listeners,
  );
  window.addEventListener('storage', renderRecords, listeners);
  update();
  renderRecords();
  return () => {
    events.abort();
    disposeTabs();
  };
}
