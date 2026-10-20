// Freeze computed presentation before moving SVG outside Mermaid's scoped container.
function presentationClone(svg) {
  const clone = svg.cloneNode(true);
  const source = [svg, ...svg.querySelectorAll('*')];
  const target = [clone, ...clone.querySelectorAll('*')];
  const properties = [
    'fill',
    'fill-opacity',
    'stroke',
    'stroke-width',
    'stroke-opacity',
    'stroke-dasharray',
    'opacity',
    'color',
    'font-family',
    'font-size',
    'font-weight',
    'line-height',
    'text-align',
    'dominant-baseline',
    'text-anchor',
    'background-color',
    'white-space',
  ];
  for (let i = 0; i < source.length; i++) {
    const style = getComputedStyle(source[i]);
    for (const property of properties)
      target[i].style.setProperty(property, style.getPropertyValue(property));
  }
  // Keep marker references local while avoiding duplicate IDs in the document.
  const suffix = '-' + crypto.randomUUID();
  const ids = new Map();
  for (const node of target) if (node.id) ids.set(node.id, node.id + suffix);
  for (const node of target) {
    if (node.id) node.id = ids.get(node.id);
    for (const attribute of [...node.attributes]) {
      let value = attribute.value;
      for (const [oldId, newId] of ids) {
        value = value.replaceAll('url(#' + oldId + ')', 'url(#' + newId + ')');
        if (
          (attribute.name === 'href' || attribute.name === 'xlink:href') &&
          value === '#' + oldId
        )
          value = '#' + newId;
      }
      if (value !== attribute.value) node.setAttribute(attribute.name, value);
    }
  }
  clone.querySelectorAll('style').forEach((node) => node.remove());
  return clone;
}
function svgBlob(svg) {
  const clone = presentationClone(svg);
  const box = svg.viewBox.baseVal;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', box.width || svg.getBoundingClientRect().width);
  clone.setAttribute(
    'height',
    box.height || svg.getBoundingClientRect().height,
  );
  clone.style.maxWidth = 'none';
  return new Blob([new XMLSerializer().serializeToString(clone)], {
    type: 'image/svg+xml;charset=utf-8',
  });
}
async function pngBlob(svg) {
  const url = URL.createObjectURL(svgBlob(svg));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const ratio = Math.min(2, 4096 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(Error('无法生成图片'))),
        'image/png',
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
function download(svg) {
  const url = URL.createObjectURL(svgBlob(svg));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'diagram.svg';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function enlarge(svg, source) {
  const dialog = document.createElement('dialog');
  dialog.className = 'diagram-dialog';
  const bar = document.createElement('div');
  bar.className = 'diagram-dialog-toolbar';
  const label = document.createElement('strong');
  label.textContent = '图表预览';
  bar.append(label);
  const viewport = document.createElement('div');
  viewport.className = 'diagram-viewport';
  const image = document.createElement('div');
  image.className = 'diagram-stage';
  viewport.append(image);
  let scale = 1,
    x = 0,
    y = 0,
    pointer;
  const update = () => {
    image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  };
  const zoom = (factor) => {
    scale = Math.min(5, Math.max(0.25, scale * factor));
    update();
  };
  for (const [name, action] of [
    ['缩小', () => zoom(1 / 1.25)],
    ['放大', () => zoom(1.25)],
    [
      '重置',
      () => {
        scale = 1;
        x = y = 0;
        update();
      },
    ],
    ['关闭', () => dialog.close()],
  ]) {
    const button = document.createElement('button');
    button.textContent = name;
    button.onclick = action;
    bar.append(button);
  }
  viewport.onwheel = (event) => {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1);
  };
  viewport.onpointerdown = (event) => {
    if (event.target.closest('a')) return;
    pointer = { x: event.clientX - x, y: event.clientY - y };
    viewport.setPointerCapture(event.pointerId);
  };
  viewport.onpointermove = (event) => {
    if (pointer) {
      x = event.clientX - pointer.x;
      y = event.clientY - pointer.y;
      update();
    }
  };
  viewport.onpointerup = viewport.onpointercancel = () => {
    pointer = null;
  };
  dialog.append(bar, viewport);
  document.body.append(dialog);
  const previous = document.activeElement;
  dialog.onclose = () => {
    dialog.remove();
    previous?.focus();
  };
  dialog.onclick = (event) => {
    if (event.target === dialog) dialog.close();
  };
  dialog.showModal();
  try {
    const { default: mermaid } = await import('mermaid');
    const rendered = await mermaid.render(
      'preview-' + crypto.randomUUID(),
      source,
    );
    if (!dialog.isConnected) return;
    image.innerHTML = rendered.svg;
    const result = image.querySelector('svg');
    result.style.maxWidth = 'none';
    result.style.width = '100%';
    result.style.height = '100%';
    result.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  } catch {
    image.textContent = '图表预览加载失败，请关闭后重试。';
  }
}
export function enhanceDiagrams(root, status) {
  for (const diagram of root.querySelectorAll('.mermaid')) {
    const svg = diagram.querySelector('svg');
    if (!svg || diagram.parentElement.classList.contains('diagram-frame'))
      continue;
    const frame = document.createElement('div');
    frame.className = 'diagram-frame';
    diagram.replaceWith(frame);
    frame.append(diagram);
    const toolbar = document.createElement('div');
    toolbar.className = 'diagram-toolbar';
    const action = (name, handler) => {
      const button = document.createElement('button');
      const paths = name.includes('放大')
        ? '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6"/>'
        : '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>';
      if (name === '复制图片' || name.includes('放大'))
        button.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${paths}</svg>`;
      else button.textContent = name;
      button.title = name;
      button.setAttribute('aria-label', name);
      button.onclick = async () => {
        try {
          await handler();
        } catch {
          status(
            '操作失败：浏览器可能不支持图片剪贴板，请下载 SVG 或复制源码。',
          );
        }
      };
      return button;
    };
    toolbar.append(
      action('⤢ 放大', () => enlarge(svg, diagram.dataset.source || '')),
      action('复制图片', async () => {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob(svg) }),
        ]);
        status('图表图片已复制。');
      }),
    );
    const more = document.createElement('details');
    more.className = 'diagram-more';
    const summary = document.createElement('summary');
    summary.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>';
    summary.title = '更多操作';
    summary.setAttribute('aria-label', '更多图表操作');
    more.append(
      summary,
      action('复制源码', async () => {
        await navigator.clipboard.writeText(diagram.dataset.source || '');
        more.open = false;
        status('Mermaid 源码已复制。');
      }),
      action('下载 SVG', () => {
        download(svg);
        more.open = false;
      }),
    );
    toolbar.append(more);
    frame.prepend(toolbar);
  }
}
