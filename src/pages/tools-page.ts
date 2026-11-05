import clipboardIcon from '../../public/favicon-clipboard.svg?raw';
import template from './tools-page.html?raw';
import { mountToolCatalog } from '../tool-catalog';

export function mountPage(root: HTMLElement) {
  root.innerHTML = template.replace('{{clipboardIcon}}', clipboardIcon);
  return mountToolCatalog(root);
}
