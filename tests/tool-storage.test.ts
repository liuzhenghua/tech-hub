import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readState,
  writeState,
  type EditorState,
} from '../src/tools/shared/storage';

test('string operations retain independent drafts, including an explicitly cleared draft', () => {
  const values = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  const state: EditorState = {
    input: 'original',
    output: 'result',
    option: 'Base64',
    variant: '',
    parameters: {},
    tree: false,
    source: false,
    wrap: true,
  };
  try {
    assert.deepEqual(readState('strings-Base64'), {});
    for (const option of ['Base64', '转义', '引号转换'])
      assert.equal(
        writeState(`strings-${option}`, { ...state, option, input: option }),
        true,
      );
    writeState('strings-转义', {
      ...state,
      option: '转义',
      input: '',
      output: '',
    });
    assert.equal(readState('strings-Base64').input, 'Base64');
    assert.equal(readState('strings-引号转换').input, '引号转换');
    assert.equal(readState('strings-转义').input, '');
    assert.equal(readState('strings-转义').output, '');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
