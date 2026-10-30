import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readUsage, recordUsage } from '../src/tool-usage';

test('usage validates stored counts and counts each tool independently', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let raw = '{"json":2,"crypto":-1,"unknown":8,"strings":"3"}';
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => raw,
      setItem: (_key: string, value: string) => {
        raw = value;
      },
    },
  });
  try {
    assert.deepEqual(readUsage(), { json: 2 });
    recordUsage('json');
    recordUsage('encoding');
    recordUsage('invalid');
    assert.deepEqual(readUsage(), { json: 3, encoding: 1 });
    raw = 'invalid JSON';
    assert.deepEqual(readUsage(), {});
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
