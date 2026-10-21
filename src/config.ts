import { normalizeDirectory } from './document-paths';
export function siteConfig(env: Record<string, string | undefined>) {
  const repository = (env.VITE_GITHUB_REPOSITORY || 'liuzhenghua/tech').trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
    throw Error('VITE_GITHUB_REPOSITORY 格式应为 owner/repo。');
  const [owner, repo] = repository.split('/');
  return {
    owner,
    repo,
    docsDir: normalizeDirectory(env.VITE_DOCS_DIR || 'docs'),
    tokenBox: env.VITE_GITHUB_TOKEN_BOX || '',
    title: env.VITE_SITE_TITLE?.trim() || '文档与工具',
  };
}
export const config = siteConfig(import.meta.env);
