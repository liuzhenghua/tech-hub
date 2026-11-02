export function timestampDate(value: string, unit: string): Date {
  if (!/^-?\d+$/.test(value.trim())) throw Error('请输入整数时间戳。');
  const number = Number(value);
  const milliseconds = unit === 'seconds' ? number * 1000 : number;
  if (!Number.isSafeInteger(milliseconds)) throw Error('时间戳超出有效范围。');
  const date = new Date(milliseconds);
  if (!Number.isFinite(date.getTime())) throw Error('时间戳超出日期范围。');
  return date;
}
export function formatDate(date: Date, utc: boolean): string {
  const parts = utc
    ? [
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
      ]
    : [
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
      ];
  const [year, month, day, hour, minute, second] = parts.map((part) =>
    String(part).padStart(2, '0'),
  );
  return `${year.padStart(4, '0')}-${month}-${day} ${hour}:${minute}:${second}`;
}
export function parseDate(value: string, utc: boolean): Date {
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) throw Error('日期格式应为 YYYY-MM-DD HH:mm:ss。');
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const date = new Date(0);
  if (utc) {
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, 0);
  } else {
    date.setFullYear(year, month - 1, day);
    date.setHours(hour, minute, second, 0);
  }
  if (formatDate(date, utc) !== value.trim().replace('T', ' '))
    throw Error('日期不存在或处于夏令时跳过的时段。');
  return date;
}
