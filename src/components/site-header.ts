import toolsIconSvg from '../../public/favicon.svg?raw';
import docsIconSvg from '../../public/favicon-docs.svg?raw';
import template from './site-header.html?raw';

/** The header is shared by route views and remains mounted during navigation. */
export function mountSiteHeader(root: HTMLElement) {
  root.innerHTML = template
    .replace(
      '{{toolsIcon}}',
      toolsIconSvg.replace('<svg ', '<svg id="title-tools-icon" '),
    )
    .replace(
      '{{docsIcon}}',
      docsIconSvg.replace('<svg ', '<svg id="title-docs-icon" hidden '),
    );
  const title = root.querySelector<HTMLElement>('#page-title')!;
  const toolsIcon = root.querySelector<SVGElement>('#title-tools-icon')!;
  const docsIcon = root.querySelector<SVGElement>('#title-docs-icon')!;
  const lockButton = root.querySelector<HTMLButtonElement>('#lock')!;
  const tools = root.querySelector<HTMLAnchorElement>('#nav-tools')!;
  const docs = root.querySelector<HTMLAnchorElement>('#nav-docs')!;
  return {
    lockButton,
    setPage(page: 'tools' | 'docs') {
      title.textContent = page === 'docs' ? '私有文档库' : '常用工具';
      toolsIcon.toggleAttribute('hidden', page !== 'tools');
      docsIcon.toggleAttribute('hidden', page !== 'docs');
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
