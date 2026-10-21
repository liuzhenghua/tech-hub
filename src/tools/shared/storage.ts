export interface EditorState {
  input: string;
  output: string;
  option: string;
  variant: string;
  parameters: Record<string, string>;
  tree: boolean;
  source: boolean;
  wrap: boolean;
}
export function readState(id: string): Partial<EditorState> {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem('tool-page-' + id + '-content') || '{}',
    );
    if (!saved || typeof saved !== 'object') return {};
    const record = saved as Record<string, unknown>;
    // Read the previous per-tab format once; the next save uses EditorState.
    const tab = id === 'digest' || id === 'crypto' ? 'hash' : id;
    const old = record[tab];
    let value = record as Partial<EditorState>;
    if (old && typeof old === 'object') {
      const legacy = old as Record<string, unknown>;
      const optionSets: Record<string, string[]> = {
        json: ['2', '4', 'tab'],
        digest: ['SHA', 'MD5', 'HMAC', 'SM3'],
        crypto: ['AES', 'RSA', '国密', 'DES'],
      };
      const index = Number(legacy.option);
      value = {
        input: typeof legacy.input === 'string' ? legacy.input : '',
        output: typeof legacy.output === 'string' ? legacy.output : '',
        option: optionSets[id]?.[index] || '',
        variant:
          typeof legacy.cryptoVariant === 'string' ? legacy.cryptoVariant : '',
        parameters: record._parameters as Record<string, string>,
        tree: legacy.treeMode !== false,
        source: legacy.markdownSource === true,
        wrap: legacy.wrap !== false,
      };
    }
    return {
      input: typeof value.input === 'string' ? value.input : '',
      output: typeof value.output === 'string' ? value.output : '',
      option: typeof value.option === 'string' ? value.option : '',
      variant: typeof value.variant === 'string' ? value.variant : '',
      parameters:
        value.parameters && typeof value.parameters === 'object'
          ? Object.fromEntries(
              Object.entries(value.parameters).filter(
                ([, v]) => typeof v === 'string',
              ),
            )
          : {},
      tree: value.tree !== false,
      source: value.source === true,
      wrap: value.wrap !== false,
    };
  } catch {
    return {};
  }
}
export function writeState(id: string, state: EditorState): boolean {
  try {
    localStorage.setItem('tool-page-' + id + '-content', JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
