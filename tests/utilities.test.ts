import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  timestampDate,
  formatDate,
  parseDate,
} from '../src/tools/utilities/time';
import { compareLines, normalizeJSON } from '../src/tools/utilities/diff';
import { testRegex } from '../src/tools/utilities/regex';

test('timestamps handle seconds, milliseconds, epoch and pre-epoch values', () => {
  assert.equal(
    timestampDate('0', 'seconds').toISOString(),
    '1970-01-01T00:00:00.000Z',
  );
  assert.equal(timestampDate('-1', 'seconds').getTime(), -1000);
  assert.equal(
    timestampDate('1700000000123', 'milliseconds').getTime(),
    1700000000123,
  );
  assert.equal(timestampDate('1700000000', 'seconds').getTime(), 1700000000000);
  for (const value of ['', '1.5', 'abc', '9007199254740992'])
    assert.throws(() => timestampDate(value, 'seconds'));
});
test('date parsing validates calendar dates and UTC/local round trips', () => {
  assert.equal(
    parseDate('2024-02-29 12:34:56', true).toISOString(),
    '2024-02-29T12:34:56.000Z',
  );
  for (const value of [
    '2023-02-29 00:00:00',
    '2024-04-31 00:00:00',
    '2024-13-01 00:00:00',
    '2024-01-01 24:00:00',
    'not a date',
  ])
    assert.throws(() => parseDate(value, true));
  const value = '2024-01-15 12:34:56';
  assert.equal(formatDate(parseDate(value, false), false), value);
  assert.equal(
    formatDate(parseDate('0099-01-01 00:00:00', true), true),
    '0099-01-01 00:00:00',
  );
});
test('line diff preserves both inputs with insertion, deletion, repetition and final newline', () => {
  for (const [left, right] of [
    ['a\nb\nc', 'a\nx\nc'],
    ['', 'a'],
    ['a', ''],
    ['', ''],
    ['a\na\nb', 'a\nb\na'],
    ['a\n', 'a'],
  ]) {
    const lines = compareLines(left, right);
    assert.equal(
      lines
        .filter((line) => line.kind !== 'add')
        .map((line) => line.text)
        .join('\n'),
      left,
    );
    assert.equal(
      lines
        .filter((line) => line.kind !== 'remove')
        .map((line) => line.text)
        .join('\n'),
      right,
    );
    assert.deepEqual(
      lines.filter((line) => line.left).map((line) => line.left),
      Array.from(
        { length: left === '' ? 0 : left.split('\n').length },
        (_, i) => i + 1,
      ),
    );
  }
  assert.equal(
    compareLines('a\r\nb', 'a\nb').every((line) => line.kind === 'same'),
    true,
  );
  assert.throws(() => compareLines('a\n'.repeat(2100), 'b\n'.repeat(2100)));
});
test('JSON comparison ignores object order but preserves array order and rejects invalid JSON', () => {
  assert.equal(
    normalizeJSON('{"z":{"b":1,"a":2},"a":0}'),
    normalizeJSON('{"a":0,"z":{"a":2,"b":1}}'),
  );
  assert.notEqual(normalizeJSON('[1,2]'), normalizeJSON('[2,1]'));
  assert.match(normalizeJSON('{"__proto__":{"x":1}}'), /__proto__/);
  assert.throws(() => normalizeJSON('{bad}'));
  assert.throws(() => normalizeJSON('{"id":9007199254740993}'), /安全整数/);
  assert.throws(() => normalizeJSON('{"id":1e400}'), /安全整数/);
  assert.match(normalizeJSON('{"id":"9007199254740993"}'), /9007199254740993/);
});
test('regex returns named and numbered groups, correct ranges and unmatched optional groups', () => {
  const { matches } = testRegex(
    '(?<year>\\d{4})-(\\d{2})',
    'g',
    'on 2024-03 and 2025-01',
  );
  assert.equal(matches.length, 2);
  assert.deepEqual([matches[0].start, matches[0].end], [3, 10]);
  assert.deepEqual(
    matches[0].groups.find((group) => group.name === 'year'),
    { name: 'year', value: '2024' },
  );
  assert.equal(testRegex('(a)?b', '', 'b').matches[0].groups[0].value, null);
});
test('regex handles empty matches, Unicode, flags, caps and invalid expressions', () => {
  assert.deepEqual(
    testRegex('(?:)', 'gu', '😀').matches.map((match) => match.start),
    [0, 2],
  );
  assert.equal(testRegex('a', '', 'aaa').matches.length, 1);
  assert.equal(testRegex('a', 'gi', 'Aa').matches.length, 2);
  assert.equal(testRegex('^b', 'gm', 'a\nb').matches.length, 1);
  assert.equal(testRegex('a.b', 's', 'a\nb').matches.length, 1);
  assert.equal(testRegex('b', 'y', 'ab').matches.length, 0);
  assert.equal(testRegex('a', 'g', 'a'.repeat(1001)).truncated, true);
  assert.throws(() => testRegex('[', 'g', 'a'));
  assert.throws(() => testRegex('a', 'gg', 'a'));
});
