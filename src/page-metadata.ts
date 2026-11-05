import docsIcon from '../public/favicon-docs.svg?url';
import clipboardIcon from '../public/favicon-clipboard.svg?url';
import toolsIcon from '../public/favicon.svg?url';

export function setPageMetadata(
  title: string,
  icon: 'docs' | 'clipboard' | 'tools' = 'tools',
) {
  document.title = title;
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link)
    link.href = { docs: docsIcon, clipboard: clipboardIcon, tools: toolsIcon }[
      icon
    ];
}
