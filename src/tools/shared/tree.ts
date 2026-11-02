import { icon } from './icons';

const LONG_VALUE_LENGTH = 80;

function copyButton(root: HTMLElement, value: unknown): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'json-node-copy';
  const label = (text: string) => {
    button.title = text;
    button.setAttribute('aria-label', text);
  };
  label(typeof value === 'string' ? '复制字符串值' : '复制 JSON 值');
  button.append(icon('copy'));
  button.onclick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    button.disabled = true;
    try {
      await navigator.clipboard.writeText(
        typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      );
      if (!root.contains(button)) return;
      button.replaceChildren(icon('check'));
      label('已复制');
    } catch {
      if (!root.contains(button)) return;
      button.replaceChildren(icon('copy'), ' 复制失败，请重试');
      label('复制失败，请重试');
    } finally {
      if (root.contains(button)) button.disabled = false;
    }
  };
  return button;
}

export function renderJSONTree(root: HTMLElement, value: unknown): void {
  function node(key: string | null, value: unknown): HTMLElement {
    if (value !== null && typeof value === 'object') {
      const group = document.createElement('details');
      group.open = true;
      const heading = document.createElement('summary');
      const entries = Object.entries(value);
      heading.textContent = `${key === null ? '' : key + ': '}${Array.isArray(value) ? 'Array' : 'Object'} (${entries.length})`;
      heading.append(copyButton(root, value));
      const children = document.createElement('div');
      children.className = 'json-children';
      let built = false;
      const build = () => {
        if (built) return;
        built = true;
        for (const [key, item] of entries) children.append(node(key, item));
      };
      group.ontoggle = () => {
        if (group.open) build();
      };
      if (entries.length < 100) build();
      else group.open = false;
      group.append(heading, children);
      return group;
    }
    const line = document.createElement('div');
    if (key !== null) {
      const label = document.createElement('span');
      label.className = 'json-key';
      label.textContent = key + ': ';
      line.append(label);
    }
    const text = document.createElement('span');
    text.className = 'json-' + (value === null ? 'null' : typeof value);
    text.textContent = JSON.stringify(value);
    const length =
      typeof value === 'string'
        ? value.length
        : (text.textContent?.length ?? 0);
    if (length > LONG_VALUE_LENGTH) line.append(copyButton(root, value), ' ');
    line.append(text);
    return line;
  }
  root.replaceChildren(node(null, value));
}
