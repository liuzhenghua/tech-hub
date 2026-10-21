export interface RepositoryConfig {
  owner: string;
  repo: string;
  docsDir?: string;
}
export interface DocumentEntry {
  path: string;
  sha: string;
  type?: string;
}
export interface Preview {
  standalone?: boolean;
  title?: string;
  text: string;
  sha?: string;
}
export interface CachedDocument {
  sha?: string;
  markdown: string;
  title: string;
}
export interface CacheData {
  scope: string;
  entries: DocumentEntry[];
  documents: Record<string, CachedDocument>;
  previews: Record<string, Preview>;
  updatedAt: number;
}
export interface RepositoryImage {
  path: string;
  encoding: string;
  content: string;
}
export interface DocumentSource {
  list(): Promise<DocumentEntry[]>;
  file(path: string): Promise<string>;
  file(path: string, raw: true): Promise<string>;
  file(path: string, raw: false): Promise<RepositoryImage>;
  close(): void;
}
export type BrowserStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
>;
