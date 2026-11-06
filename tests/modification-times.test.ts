import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareModificationTimes,
  loadModificationTimes,
} from '../src/documents/modification-times';
import type { DocumentEntry } from '../src/documents/types';

test('documents sort newest first, break ties by path and place missing times last', () => {
  const entries = [
    { path: 'z', sha: '', modifiedAt: 100 },
    { path: 'unknown', sha: '' },
    { path: 'new', sha: '', modifiedAt: 200 },
    { path: 'a', sha: '', modifiedAt: 100 },
    { path: 'invalid', sha: '', modifiedAt: NaN },
  ];
  assert.deepEqual(
    entries.sort(compareModificationTimes).map((x) => x.path),
    ['new', 'a', 'z', 'invalid', 'unknown'],
  );
});

test('modification queries use at most three workers, reuse only the same snapshot and tolerate failures', async () => {
  const entries: DocumentEntry[] = Array.from({ length: 7 }, (_, i) => ({
    path: String(i),
    sha: 'blob',
  }));
  const cached = [
    { path: '0', sha: 'blob', modifiedRef: 'head', modifiedAt: 100 },
    { path: '1', sha: 'blob', modifiedRef: 'old', modifiedAt: 50 },
  ];
  let running = 0,
    peak = 0;
  const calls: string[] = [];
  await loadModificationTimes(
    entries,
    cached,
    'head',
    async (path) => {
      calls.push(path);
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setImmediate(resolve));
      running--;
      if (path === '2') throw Error('unavailable');
      return path === '3' ? NaN : 200;
    },
    () => true,
  );
  assert.equal(peak, 3);
  assert.ok(!calls.includes('0'));
  assert.ok(calls.includes('1'));
  assert.equal(entries[0].modifiedAt, 100);
  assert.equal(entries[1].modifiedAt, 200);
  assert.equal(entries[2].modifiedAt, undefined);
  assert.equal(entries[3].modifiedAt, undefined);
});

test('cancelled queries cannot publish stale timestamps', async () => {
  let active = true;
  const entries = [{ path: 'doc', sha: '' }];
  await assert.rejects(
    loadModificationTimes(
      entries,
      [],
      'head',
      async () => {
        active = false;
        return 200;
      },
      () => active,
    ),
    { name: 'AbortError' },
  );
  assert.equal((entries[0] as DocumentEntry).modifiedAt, undefined);
});

test('refresh preserves the previous order until all times settle and clears failed stale times', async () => {
  const entries: DocumentEntry[] = [
    { path: 'a', sha: 'new', modifiedAt: 100, modifiedRef: 'old' },
    { path: 'b', sha: 'same', modifiedAt: 200, modifiedRef: 'old' },
  ];
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const loading = loadModificationTimes(
    entries,
    entries,
    'head',
    async (path) => {
      if (path === 'a') return 300;
      await pending;
      throw Error('unavailable');
    },
    () => true,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(
    [...entries].sort(compareModificationTimes).map((x) => x.path),
    ['b', 'a'],
  );
  assert.equal(entries[0].modifiedAt, 100);
  finish();
  await loading;
  assert.deepEqual(
    [...entries].sort(compareModificationTimes).map((x) => x.path),
    ['a', 'b'],
  );
  assert.equal(entries[0].modifiedRef, 'head');
  assert.equal(entries[1].modifiedAt, undefined);
  assert.equal(entries[1].modifiedRef, undefined);
});
