import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLines } from '../src/tools/utilities/diff';
import { alignChangedLines } from '../src/tools/utilities/diff-alignment';
import { inlineDiff } from '../src/tools/utilities/inline-diff';

function align(left: string, right: string) {
  const lines = compareLines(left, right);
  return alignChangedLines(
    lines.filter((line) => line.kind === 'remove'),
    lines.filter((line) => line.kind === 'add'),
  );
}

test('aligns indented purpose and search after collapsed path and inserted blanks', () => {
  const paragraphs = [
    '<purpose>',
    "This repository is the user's persistent knowledge base and file storage.",
    'It helps the Agent retain context, retrieve information, and continue work.',
    '</purpose>',
    '<search>',
    'Search when existing materials may help with the task.',
    '</search>',
  ];
  const left = ['<path>', '/local/repository', '</path>', ...paragraphs];
  const right = [
    '  <path>{knowledge_repo_path}</path>',
    '',
    ...paragraphs.slice(0, 4).map((line) => '    ' + line),
    '',
    ...paragraphs.slice(4).map((line) => '    ' + line),
  ];
  const pairs = align(left.join('\n'), right.join('\n'));
  for (const paragraph of paragraphs) {
    const pair = pairs.find(([line]) => line?.text === paragraph)!;
    assert.equal(pair[1]?.text, '    ' + paragraph);
    const parts = inlineDiff(pair[0]!.text, pair[1]!.text);
    assert.equal(parts[0].filter((part) => part.changed).length, 0);
    assert.equal(
      parts[1]
        .filter((part) => part.changed)
        .map((p) => p.text)
        .join(''),
      '    ',
    );
  }
  assert.deepEqual(
    pairs.flatMap(([line]) => (line ? [line.text] : [])),
    left,
  );
  assert.deepEqual(
    pairs.flatMap(([, line]) => (line ? [line.text] : [])),
    right,
  );
});

test('pairs edited lines between anchors and retains unmatched additions', () => {
  const pairs = align(
    'start\nold value\nend',
    '  start\nnew value\nextra\n  end',
  );
  assert.deepEqual(
    pairs.map(([a, b]) => [a?.text, b?.text]),
    [
      ['start', '  start'],
      ['old value', 'new value'],
      [undefined, 'extra'],
      ['end', '  end'],
    ],
  );
});

test('supports empty sides and repeated lines without losing source order', () => {
  assert.deepEqual(align('', ''), []);
  assert.equal(align('removed', '')[0][1], undefined);
  assert.equal(align('', 'added')[0][0], undefined);
  const pairs = align('item\nitem\nend', '  item\n\n  item\n  end');
  assert.deepEqual(
    pairs.filter(([a, b]) => a && b).map(([a, b]) => [a!.text, b!.text.trim()]),
    [
      ['item', 'item'],
      ['item', 'item'],
      ['end', 'end'],
    ],
  );
});
