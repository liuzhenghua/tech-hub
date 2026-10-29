import { setButtonLabel } from './button-label';
import type { ToolDefinition, CryptoParameters } from './types';
import { readState, writeState } from './storage';
import { renderJSONTree } from './tree';
import { renderMarkdown } from '../../markdown';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { encodeBytes } from './bytes';
import { mountOptionTabs } from './option-tabs';

export function mountEditor(
  root: HTMLElement,
  tool: ToolDefinition,
): () => void {
  function element<T extends HTMLElement>(id: string): T {
    const node = root.querySelector<HTMLElement>('#' + id);
    if (!node) throw Error(`缺少编辑器元素 ${id}`);
    return node as T;
  }
  const input = element<HTMLTextAreaElement>('input'),
    output = element<HTMLTextAreaElement>('output');
  const option = element<HTMLSelectElement>('option'),
    variant = element<HTMLSelectElement>('crypto-variant');
  const preview = element<HTMLDivElement>('markdown-preview'),
    tree = element<HTMLDivElement>('json-tree');
  let saved = readState(tool.id);
  if (tool.id === 'strings') {
    const selected = tool.options.includes(saved.option || '')
      ? saved.option!
      : tool.options[0];
    const optionState = readState(`${tool.id}-${selected}`);
    if (optionState.input !== undefined)
      saved = { ...optionState, option: selected };
  }
  const events = new AbortController();
  let revision = 0,
    busy = false,
    treeMode = saved.tree !== false,
    source = saved.source === true,
    wrap = saved.wrap !== false,
    timer: ReturnType<typeof setTimeout> | undefined,
    disposed = false,
    pasting = false;
  let renderQueue = Promise.resolve();
  const parameterIds = [
    'jwt-key',
    'aes-key',
    'aes-iv',
    'aes-key-format',
    'aes-format',
    'rsa-key',
    'rsa-format',
    'sm2-key',
    'sm2-format',
    'sm2-prefix',
  ] as const;
  const field = (id: string) =>
    element<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(id);
  const message = (text: string, error = false) => {
    element('status').textContent = text;
    element('status').classList.toggle('error', error);
  };
  const on = (
    node: EventTarget | null,
    event: string,
    handler: EventListener,
  ) => node?.addEventListener(event, handler, { signal: events.signal });
  function persist() {
    const state = {
      input: input.value,
      output: output.value,
      option: option.value,
      variant: variant.value,
      parameters: Object.fromEntries(
        parameterIds.map((id) => [id, field(id).value]),
      ),
      tree: treeMode,
      source,
      wrap,
    };
    const success = writeState(tool.id, state);
    const optionSaved =
      tool.id !== 'strings' || writeState(`${tool.id}-${option.value}`, state);
    element('storage-note').textContent =
      success && optionSaved
        ? '内容自动保存在本机'
        : '本地保存失败，请复制重要内容';
  }
  function parameters(): CryptoParameters {
    return {
      key: field('aes-key').value,
      keyFormat: field('aes-key-format').value,
      iv: field('aes-iv').value,
      format: field('aes-format').value,
      rsaKey: field('rsa-key').value,
      rsaFormat: field('rsa-format').value,
      sm2Key: field('sm2-key').value,
      sm2Format: field('sm2-format').value,
      sm2Prefix: field('sm2-prefix').value,
    };
  }
  function view() {
    const hasTree = tool.id === 'json' && output.value !== '';
    element('json-controls').hidden = !hasTree;
    for (const id of ['expand-all', 'collapse-all', 'tree-expand-toggle']) {
      const button = root.querySelector<HTMLElement>('#' + id);
      if (button) button.hidden = !treeMode;
    }
    tree.hidden = !(hasTree && treeMode);
    output.hidden = (hasTree && treeMode) || (!!tool.markdown && !source);
    preview.hidden = !tool.markdown || source;
    element('markdown-toggle').hidden = !tool.markdown;
    element('markdown-toggle').textContent = source ? '预览' : 'HTML 源码';
    element('tree-toggle').textContent = treeMode ? '文本视图' : '树形视图';
    element('tree-toggle').setAttribute('aria-pressed', String(treeMode));
    setButtonLabel(
      element('copy'),
      tool.markdown ? (source ? '复制 HTML' : '复制富文本') : '复制结果',
    );
    const reuse = root.querySelector<HTMLButtonElement>('#reuse-output');
    if (reuse) reuse.disabled = !output.value;
    element<HTMLButtonElement>('copy').disabled = !output.value;
  }
  function clear() {
    message('');
    if (tool.id === 'crypto')
      root.querySelector('label[for="output"]')!.textContent = '处理结果';
    output.value = '';
    tree.replaceChildren();
    element('jwt-info').textContent = '';
    element('jwt-info').hidden = true;
    view();
  }
  function queueMarkdown(value: string, token: number) {
    renderQueue = renderQueue
      .catch(() => {})
      .then(async () => {
        if (disposed || token !== revision) return;
        await renderMarkdown(preview, value, message);
        if (token === revision && !disposed) {
          output.value = DOMPurify.sanitize(await marked.parse(value));
          view();
          persist();
        }
      })
      .catch((error) => {
        if (token === revision)
          message(error instanceof Error ? error.message : String(error), true);
      });
  }
  async function run(action: string) {
    if (busy) return;
    const token = ++revision;
    busy = true;
    setBusy();
    message('处理中…');
    try {
      const result = await tool.run({
        value: input.value,
        action,
        option: option.value,
        variant: variant.value,
        jwtKey: field('jwt-key').value,
        parameters: parameters(),
      });
      if (disposed || token !== revision) return;
      output.value = result.output;
      if (tool.id === 'crypto') {
        root.querySelector('label[for="output"]')!.textContent =
          action === 'encrypt' ? '密文' : '解密原文';
      }
      if (result.json) {
        renderJSONTree(tree, JSON.parse(result.output));
        if (action === 'minify') treeMode = false;
      }
      element('jwt-info').textContent = result.info || '';
      element('jwt-info').hidden = !result.info;
      if (tool.markdown) queueMarkdown(input.value, token);
      view();
      persist();
      message('完成');
    } catch (error) {
      if (!disposed && token === revision) {
        if (tool.id === 'jwt' && action === 'verify') {
          element('jwt-info').textContent =
            '签名未完成校验，请检查密钥与算法。';
          element('jwt-info').hidden = false;
        } else clear();
        message(error instanceof Error ? error.message : String(error), true);
      }
    } finally {
      busy = false;
      if (!disposed) setBusy();
    }
  }
  function setBusy() {
    element('actions')
      .querySelectorAll('button')
      .forEach((button) => {
        button.disabled = busy;
      });
  }
  function controls(restore = false) {
    const algorithm = variant.value || option.value,
      isCipher = tool.id === 'crypto',
      hmac = tool.id === 'digest' && option.value === 'HMAC',
      rsa = isCipher && algorithm.startsWith('RSA'),
      sm2 = isCipher && algorithm.startsWith('SM2'),
      symmetric = isCipher && !rsa && !sm2;
    element('aes-controls').hidden = !(symmetric || hmac);
    element('rsa-controls').hidden = !rsa;
    element('sm2-controls').hidden = !sm2;
    element('jwt-key-row').hidden = tool.id !== 'jwt';
    const noIV = algorithm.endsWith('ECB') || hmac;
    field('aes-iv').parentElement!.hidden = noIV;
    element('aes-generate-iv').hidden = noIV;
    const bytes = algorithm.startsWith('SM4')
      ? 16
      : algorithm.startsWith('3DES')
        ? 24
        : algorithm.startsWith('DES')
          ? 8
          : 32;
    element('aes-generate-key').textContent = `生成 ${bytes * 8} 位密钥`;
    element('aes-generate-key').hidden = hmac;
    element<HTMLInputElement>('aes-key').placeholder = hmac
      ? '任意非空密钥'
      : algorithm.startsWith('AES')
        ? '16 / 24 / 32 字节原始密钥'
        : `${bytes} 字节密钥`;
    element('hint').textContent =
      typeof tool.hint === 'function'
        ? tool.hint(option.value, variant.value)
        : tool.hint;
    element('actions').replaceChildren();
    for (const action of tool.actions(option.value)) {
      const button = document.createElement('button');
      button.textContent = action.label;
      button.onclick = () => void run(action.id);
      element('actions').append(button);
    }
    if (tool.reuseOutput) {
      root.querySelector('#reuse-output')?.remove();
      const reuse = document.createElement('button');
      reuse.id = 'reuse-output';
      reuse.textContent = '用作输入';
      reuse.title = '用当前结果替换原文，继续处理';
      reuse.disabled = !output.value;
      reuse.onclick = () => {
        input.value = output.value;
        inputChanged();
      };
      output
        .closest('.editor')!
        .querySelector('.editor-controls')!
        .append(reuse);
    }
    setBusy();
    if (!restore) persist();
  }
  function variants(restore = false) {
    const values = tool.variants?.(option.value) || [];
    variant.replaceChildren(...values.map((value) => new Option(value, value)));
    if (restore && saved.variant && values.includes(saved.variant))
      variant.value = saved.variant;
    variant.hidden = !values.length;
    controls(restore);
  }
  function inputChanged() {
    revision++;
    element('count').textContent =
      `· ${new TextEncoder().encode(input.value).length} 字节`;
    clear();
    message('');
    clearTimeout(timer);
    if (tool.markdown) {
      const token = revision;
      timer = setTimeout(() => queueMarkdown(input.value, token), 200);
    } else if (tool.autoAction && input.value.trim()) {
      timer = setTimeout(() => void run(tool.autoAction!), 200);
    }
    persist();
  }
  const heading = root.querySelector('h1')!;
  if (heading && !heading.querySelector('[data-mode]'))
    heading.textContent = tool.title;
  document.title =
    tool.title + ' · ' + (import.meta.env.VITE_SITE_TITLE || '文档与工具');
  option.replaceChildren(
    ...tool.options.map(
      (value) => new Option(value === 'tab' ? 'Tab' : value, value),
    ),
  );
  if (saved.option && tool.options.includes(saved.option))
    option.value = saved.option;
  option.hidden = !tool.options.length;
  element('option-label').hidden = option.hidden;
  element('option-label').textContent = tool.optionLabel || '';
  for (const id of parameterIds) {
    const value = saved.parameters?.[id];
    if (typeof value === 'string') field(id).value = value;
  }
  input.value = saved.input || '';
  output.value = saved.output || '';
  tree.replaceChildren();
  message('');
  variants(true);
  const disposeOptionTabs = mountOptionTabs(option);
  on(input, 'paste', () => {
    pasting = true;
  });
  on(input, 'input', (event) => {
    inputChanged();
    if (
      tool.id === 'json' &&
      (pasting || (event as InputEvent).inputType === 'insertFromPaste')
    ) {
      timer = setTimeout(() => void run('format'), 0);
    }
    pasting = false;
  });
  // Save the legacy string state into its selected operation before switching.
  if (tool.id === 'strings') persist();
  on(option, 'change', () => {
    revision++;
    clearTimeout(timer);
    clear();
    if (tool.id === 'strings') restoreStringOption();
    variants();
    view();
  });
  function restoreStringOption() {
    const state = readState(`${tool.id}-${option.value}`);
    input.value = state.input || '';
    output.value = state.output || '';
    wrap = state.wrap !== false;
    updateWrap();
    element('count').textContent =
      `· ${new TextEncoder().encode(input.value).length} 字节`;
  }
  on(variant, 'change', () => {
    revision++;
    clear();
    controls();
  });
  for (const id of parameterIds)
    on(field(id), 'input', () => {
      revision++;
      if (tool.id === 'jwt') {
        element('jwt-info').textContent = '密钥已更改，未校验签名';
        element('jwt-info').hidden = false;
      } else clear();
      persist();
    });
  on(element('tree-toggle'), 'click', () => {
    treeMode = !treeMode;
    view();
    persist();
  });
  on(root.querySelector('#expand-all'), 'click', () => {
    const expand = () => {
      let changed = false;
      tree.querySelectorAll('details').forEach((node) => {
        if (!node.open) {
          node.open = true;
          changed = true;
        }
      });
      if (changed)
        requestAnimationFrame(() => {
          if (!disposed) expand();
        });
    };
    expand();
  });
  on(root.querySelector('#collapse-all'), 'click', () =>
    tree.querySelectorAll('details').forEach((node) => {
      node.open = false;
    }),
  );
  on(element('markdown-toggle'), 'click', () => {
    source = !source;
    view();
    persist();
  });
  on(element('clear'), 'click', () => {
    input.value = '';
    inputChanged();
  });
  function updateWrap() {
    input.wrap = wrap ? 'soft' : 'off';
    setButtonLabel(element('input-wrap'), '自动换行：' + (wrap ? '开' : '关'));
    element('input-wrap').setAttribute('aria-pressed', String(wrap));
  }
  on(element('input-wrap'), 'click', () => {
    wrap = !wrap;
    updateWrap();
    persist();
  });
  on(element('copy'), 'click', () => {
    void (async () => {
      try {
        if (tool.markdown && !source && typeof ClipboardItem !== 'undefined') {
          const clean = preview.cloneNode(true) as HTMLElement;
          clean
            .querySelectorAll('button,.diagram-toolbar')
            .forEach((node) => node.remove());
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([clean.innerHTML], { type: 'text/html' }),
              'text/plain': new Blob([clean.textContent || ''], {
                type: 'text/plain',
              }),
            }),
          ]);
        } else await navigator.clipboard.writeText(output.value);
        message('已复制');
      } catch {
        message('复制失败，请手动选中内容复制。', true);
      }
    })();
  });
  on(element('aes-generate-key'), 'click', () => {
    const algorithm = variant.value;
    const size = algorithm.startsWith('SM4')
      ? 16
      : algorithm.startsWith('3DES')
        ? 24
        : algorithm.startsWith('DES')
          ? 8
          : 32;
    field('aes-key-format').value = 'Hex';
    field('aes-key').value = encodeBytes(
      crypto.getRandomValues(new Uint8Array(size)),
      'Hex',
    );
    revision++;
    clear();
    persist();
  });
  on(element('aes-generate-iv'), 'click', () => {
    const algorithm = variant.value;
    const size =
      algorithm === 'AES-GCM' ? 12 : /^(DES|3DES)/.test(algorithm) ? 8 : 16;
    field('aes-iv').value = encodeBytes(
      crypto.getRandomValues(new Uint8Array(size)),
      'Hex',
    );
    revision++;
    clear();
    persist();
  });
  on(window, 'pagehide', () => persist());
  updateWrap();
  element('count').textContent = input.value
    ? `· ${new TextEncoder().encode(input.value).length} 字节`
    : '';
  view();
  if (tool.id === 'json' && output.value) {
    try {
      renderJSONTree(tree, JSON.parse(output.value));
    } catch {
      clear();
    }
  }
  if (tool.markdown) queueMarkdown(input.value, revision);
  else if (tool.autoAction && input.value.trim()) void run(tool.autoAction);
  return () => {
    disposed = true;
    revision++;
    events.abort();
    disposeOptionTabs();
    root.querySelector('#reuse-output')?.remove();
    clearTimeout(timer);
  };
}
