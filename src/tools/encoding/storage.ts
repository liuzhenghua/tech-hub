import { readState, writeState, type EditorState } from '../shared/storage';

/** Preserve the previous Base64 draft without replacing an existing encoding draft. */
export function migrateBase64State(): void {
  if (readState('encoding-Base64').input !== undefined) return;
  const previous = readState('strings');
  const legacy = readState('strings-Base64');
  const source =
    legacy.input !== undefined
      ? legacy
      : previous.option === 'Base64'
        ? previous
        : {};
  if (source.input === undefined) return;
  const state: EditorState = {
    input: source.input,
    output: source.output || '',
    option: 'Base64',
    variant: '',
    parameters: {},
    tree: false,
    source: false,
    wrap: source.wrap !== false,
  };
  writeState('encoding-Base64', state);
}
