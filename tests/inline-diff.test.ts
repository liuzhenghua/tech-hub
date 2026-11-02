import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inlineDiff } from '../src/tools/utilities/inline-diff';
test('inline diff highlights individual edits while preserving both original strings', () => {
  for (const [left, right] of [
    ['return a - b;', 'return a + b;'],
    ['你好😀甲和乙', '你好😃丙和丁'],
    ['abc', 'abxc'],
    ['', 'text'],
    ['same', 'same'],
    ['a'.repeat(600), 'b'.repeat(600)],
  ]) {
    const parts = inlineDiff(left, right);
    assert.equal(parts[0].map((p) => p.text).join(''), left);
    assert.equal(parts[1].map((p) => p.text).join(''), right);
  }
  const parts = inlineDiff('return a - b;', 'return a + b;');
  assert.equal(
    parts[0]
      .filter((p) => p.changed)
      .map((p) => p.text)
      .join(''),
    '-',
  );
  assert.equal(
    parts[1]
      .filter((p) => p.changed)
      .map((p) => p.text)
      .join(''),
    '+',
  );
  assert.equal(
    inlineDiff('same', 'same')[0].some((p) => p.changed),
    false,
  );
});
