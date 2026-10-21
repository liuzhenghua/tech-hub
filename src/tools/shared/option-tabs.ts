/** Expose a short list of mutually exclusive settings without a popup. */
export function mountOptionTabs(select: HTMLSelectElement): () => void {
  if (!select.options.length) return () => {};
  const label = select.labels?.[0];
  const group = document.createElement('div');
  group.className = 'option-tabs';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', label?.textContent || '选项');
  const events = new AbortController();
  const buttons = Array.from(select.options, (option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent =
      label?.textContent === '缩进'
        ? option.value === 'tab'
          ? 'Tab 缩进'
          : `${option.text} 空格`
        : option.text;
    button.addEventListener(
      'click',
      () => {
        if (select.value === option.value) return;
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      },
      { signal: events.signal },
    );
    group.append(button);
    return { button, value: option.value };
  });
  function update() {
    for (const { button, value } of buttons)
      button.setAttribute('aria-pressed', String(select.value === value));
  }
  select.hidden = true;
  if (label) label.hidden = true;
  select.after(group);
  select.addEventListener('change', update, { signal: events.signal });
  update();
  return () => {
    events.abort();
    group.remove();
  };
}
