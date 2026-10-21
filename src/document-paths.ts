export function normalizeDirectory(value: string = 'docs') {
  const directory = value.trim().replace(/^\/+|\/+$/g, '');
  if (value.trim() === '/') return '';
  if (
    !directory ||
    directory.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw Error('文档目录必须是有效的仓库相对路径。');
  return directory;
}
export function isDocumentPath(path: unknown, directory: string = 'docs') {
  return (
    typeof path === 'string' &&
    (directory === '' || path.startsWith(directory + '/')) &&
    /\.md$/i.test(path) &&
    !path.split('/').some((part) => !part || part === '..' || part === '.')
  );
}
