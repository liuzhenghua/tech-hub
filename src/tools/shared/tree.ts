export function renderJSONTree(root: HTMLElement, value: unknown): void {
  function node(key: string | null, value: unknown): HTMLElement {
    if (value !== null && typeof value === 'object') {
      const group = document.createElement('details');
      group.open = true;
      const heading = document.createElement('summary');
      const entries = Object.entries(value);
      heading.textContent = `${key === null ? '' : key + ': '}${Array.isArray(value) ? 'Array' : 'Object'} (${entries.length})`;
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
    line.append(text);
    return line;
  }
  root.replaceChildren(node(null, value));
}
