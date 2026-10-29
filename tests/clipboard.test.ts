import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createClipboard,
  addCategory,
  addEntry,
  activeCategory,
  parseClipboard,
} from '../src/tools/clipboard/model';

test('clipboard starts with a default category and isolates category entries', () => {
  const state = createClipboard();
  assert.equal(activeCategory(state).name, '默认');
  addEntry(state, '  默认内容\n保留换行  ', 'first');
  addCategory(state, ' 工作 ', 'work');
  assert.equal(activeCategory(state).name, '工作');
  assert.deepEqual(activeCategory(state).entries, []);
  addEntry(state, '工作内容', 'second');
  const restored = parseClipboard(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.activeId, 'work');
  assert.equal(activeCategory(restored).entries[0].text, '工作内容');
  restored.activeId = 'default';
  assert.equal(
    activeCategory(restored).entries[0].text,
    '  默认内容\n保留换行  ',
  );
});

test('clipboard rejects blank or duplicate categories and blank entries without mutation', () => {
  const state = createClipboard();
  assert.throws(() => addCategory(state, ' ', 'blank'));
  assert.throws(() => addCategory(state, ' 默认 ', 'duplicate'));
  assert.throws(() => addEntry(state, '\n ', 'blank'));
  assert.equal(state.categories.length, 1);
  assert.deepEqual(activeCategory(state).entries, []);
});

test('clipboard validates persisted content and falls back from a missing selected category', () => {
  for (const invalid of [
    null,
    {},
    { categories: [] },
    { categories: [{ id: 'x', name: 'X', entries: [{ text: 12 }] }] },
  ])
    assert.throws(() => parseClipboard(invalid));
  const state = createClipboard();
  assert.throws(() =>
    parseClipboard({
      ...state,
      categories: [...state.categories, ...state.categories],
    }),
  );
  activeCategory(state).entries = [
    { id: 'a', text: 'A' },
    { id: 'a', text: 'B' },
  ];
  assert.throws(() => parseClipboard(state));
  const fallback = parseClipboard({
    ...createClipboard(),
    activeId: 'missing',
  });
  assert.equal(fallback.activeId, 'default');
});
