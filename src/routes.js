import { isDocumentPath } from './document-paths.js';
export function documentHash(path, anchor = '') {
  return (
    '#docs?' +
    new URLSearchParams({ path, ...(anchor ? { section: anchor } : {}) })
  );
}
export function parseRoute(hash, directory = 'docs') {
  const [page, query = ''] = hash.slice(1).split('?');
  const params = new URLSearchParams(query);
  const path = params.get('path') || '';
  return {
    docs: page === 'docs',
    path: isDocumentPath(path, directory) ? path : '',
    anchor: params.get('section') || '',
  };
}
