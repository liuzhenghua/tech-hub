import { isDocumentPath } from './document-paths';
export function documentHash(path: string, anchor = '') {
  return (
    '#docs?' +
    new URLSearchParams({ path, ...(anchor ? { section: anchor } : {}) })
  );
}
export function parseRoute(hash: string, directory = 'docs') {
  const [page, query = ''] = hash.slice(1).split('?');
  const params = new URLSearchParams(query);
  const path = params.get('path') || '';
  return {
    docs: page === 'docs',
    path: isDocumentPath(path, directory) ? path : '',
    anchor: params.get('section') || '',
  };
}
