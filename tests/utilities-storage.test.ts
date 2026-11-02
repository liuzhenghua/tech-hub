import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readDiffDraft,
  writeDiffDraft,
} from '../src/tools/utilities/diff-storage';
import {
  readRegexDraft,
  writeRegexDraft,
} from '../src/tools/utilities/regex-storage';
test('utility drafts restore text and options, preserve cleared input and reject corrupt storage', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  try {
    const diff = {
      left: 'a\nb',
      right: 'a\nc',
      mode: 'json' as const,
      view: 'unified' as const,
      wrap: false,
      hideSame: true,
    };
    assert.equal(writeDiffDraft(diff), true);
    assert.deepEqual(readDiffDraft(), diff);
    const regex = { pattern: String.raw`\d+`, text: '123 中文', flags: 'gi' };
    assert.equal(writeRegexDraft(regex), true);
    assert.deepEqual(readRegexDraft(), regex);
    writeRegexDraft({ ...regex, pattern: '', text: '' });
    assert.equal(readRegexDraft()?.text, '');
    writeDiffDraft({ ...diff, left: '', right: '' });
    assert.equal(readDiffDraft()?.left, '');
    values.set('tool-diff-draft', '{');
    values.set('tool-regex-draft', '{"pattern":4}');
    assert.equal(readDiffDraft(), null);
    assert.equal(readRegexDraft(), null);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw Error('unavailable');
      },
    });
    assert.equal(readDiffDraft(), null);
    assert.equal(readRegexDraft(), null);
    assert.equal(writeDiffDraft(diff), false);
    assert.equal(writeRegexDraft(regex), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
