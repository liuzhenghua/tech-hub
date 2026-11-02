/** Decorative placeholders with one accessible loading announcement. */
export function documentLoading(layout: 'catalog' | 'reader'): HTMLElement {
  const loading = document.createElement('div');
  loading.className = `document-loading document-loading-${layout}`;
  loading.setAttribute('role', 'status');
  const label = document.createElement('div');
  label.className = 'document-loading-label';
  label.textContent = layout === 'reader' ? '正在打开文档…' : '正在整理文档…';
  const content = document.createElement('div');
  content.className = 'document-loading-content';
  content.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < (layout === 'catalog' ? 6 : 3); i++) {
    const block = document.createElement('div');
    block.className = 'document-loading-block';
    for (let j = 0; j < 4; j++) {
      const line = document.createElement('span');
      line.className = 'document-loading-line';
      block.append(line);
    }
    content.append(block);
  }
  loading.append(label, content);
  return loading;
}
