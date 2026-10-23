import template from './tools-page.html?raw';
import { mountToolCatalog } from '../tool-catalog';

export function mountPage(root: HTMLElement) {
  root.innerHTML = template;
  return mountToolCatalog(root);
}
