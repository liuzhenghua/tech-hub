import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformEncoding } from '../src/tools/encoding/transform';
import { migrateBase64State } from '../src/tools/encoding/storage';
import {
  readState,
  writeState,
  type EditorState,
} from '../src/tools/shared/storage';

for (const format of ['Base64', 'Hex', 'URL']) {
  test(`${format} round-trips UTF-8 text and empty input`, () => {
    for (const value of ['', 'Hello', '中文 😀\n"\\ +&=?/#%']) {
      const encoded = transformEncoding(value, format, 'encode');
      assert.equal(transformEncoding(encoded, format, 'decode'), value);
    }
  });
}
test('encoding uses standard Base64, UTF-8 Hex, and URL parameter escaping', () => {
  assert.equal(transformEncoding('你好', 'Base64', 'encode'), '5L2g5aW9');
  assert.equal(transformEncoding('你好', 'Hex', 'encode'), 'e4bda0e5a5bd');
  assert.equal(
    transformEncoding('E4 BD A0\nE5 A5 BD', 'Hex', 'decode'),
    '你好',
  );
  assert.equal(
    transformEncoding('a b+c&d=e', 'URL', 'encode'),
    'a%20b%2Bc%26d%3De',
  );
  assert.equal(transformEncoding('a+b%20c', 'URL', 'decode'), 'a+b c');
  assert.equal(transformEncoding('%2520', 'URL', 'decode'), '%20');
});
test('malformed encoding and non-UTF-8 bytes are rejected', () => {
  for (const value of ['%', 'A', 'ab?c'])
    assert.throws(() => transformEncoding(value, 'Base64', 'decode'));
  for (const value of ['a', 'zz', '0x12'])
    assert.throws(() => transformEncoding(value, 'Hex', 'decode'));
  assert.throws(() => transformEncoding('/w==', 'Base64', 'decode'));
  assert.throws(() => transformEncoding('ff', 'Hex', 'decode'));
  assert.throws(() => transformEncoding('%E4%A0', 'URL', 'decode'));
  assert.throws(() => transformEncoding('x', 'unknown', 'encode'));
  assert.throws(() => transformEncoding('x', 'Hex', 'unknown'));
});
const draft = (input: string, option: string): EditorState => ({
  input,
  option,
  output: 'result',
  variant: '',
  parameters: {},
  tree: false,
  source: false,
  wrap: true,
});
function withStorage(run: () => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const items = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
    },
  });
  try {
    run();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}
test('Base64 draft migration preserves existing encoding drafts and other string operations', () =>
  withStorage(() => {
    writeState('strings-Base64', draft('legacy Base64', 'Base64'));
    writeState('strings-转义', draft('escape draft', '转义'));
    migrateBase64State();
    assert.equal(readState('encoding-Base64').input, 'legacy Base64');
    assert.equal(readState('strings-转义').input, 'escape draft');
    writeState('encoding-Base64', draft('', 'Base64'));
    migrateBase64State();
    assert.equal(readState('encoding-Base64').input, '');
  }));
test('migration supports the old single-draft format without copying an unrelated operation', () =>
  withStorage(() => {
    writeState('strings', draft('escape draft', '转义'));
    migrateBase64State();
    assert.deepEqual(readState('encoding-Base64'), {});
    writeState('strings', draft('old Base64', 'Base64'));
    migrateBase64State();
    assert.equal(readState('encoding-Base64').input, 'old Base64');
    assert.equal(readState('encoding-Base64').output, 'result');
  }));
