export function normalizeDirectory(value = 'docs') {
  const directory = value.trim().replace(/^\/+|\/+$/g, '');
  if (value.trim() === '/') return '';
  if (
    !directory ||
    directory.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw Error('文档目录必须是有效的仓库相对路径。');
  return directory;
}
export function isDocumentPath(path, directory = 'docs') {
  return (
    typeof path === 'string' &&
    (directory === '' || path.startsWith(directory + '/')) &&
    /\.md$/i.test(path) &&
    !path.split('/').some((part) => !part || part === '..' || part === '.')
  );
}
