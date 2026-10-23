import template from './site-header.html?raw';

/** The header is shared by route views and remains mounted during navigation. */
export function mountSiteHeader(root: HTMLElement, title: string) {
  root.innerHTML = template;
  root.querySelector('#site-brand')!.textContent = title;
  const lockButton = root.querySelector<HTMLButtonElement>('#lock')!;
  const tools = root.querySelector<HTMLAnchorElement>('#nav-tools')!;
  const docs = root.querySelector<HTMLAnchorElement>('#nav-docs')!;
  return {
    lockButton,
    setPage(page: 'tools' | 'docs') {
      for (const [link, active] of [
        [tools, page === 'tools'],
        [docs, page === 'docs'],
      ] as const) {
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
      lockButton.hidden = true;
    },
  };
}
