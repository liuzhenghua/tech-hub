const paths = {
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
export function icon(name: keyof typeof paths): SVGSVGElement {
  const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  element.setAttribute('viewBox', '0 0 24 24');
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = paths[name];
  return element;
}
