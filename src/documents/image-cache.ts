import type { RepositoryImage } from './types';

/** Bounded session memory; Base64 strings are conservatively counted as UTF-16. */
export class ImageCache {
  private values = new Map<string, RepositoryImage>();
  private pending = new Map<string, Promise<RepositoryImage>>();
  private bytes = 0;
  private generation = 0;
  constructor(private readonly limit = 32 * 1024 * 1024) {}

  get(
    key: string,
    read: () => Promise<RepositoryImage>,
  ): Promise<RepositoryImage> {
    const cached = this.values.get(key);
    if (cached) {
      this.values.delete(key);
      this.values.set(key, cached);
      return Promise.resolve(cached);
    }
    const pending = this.pending.get(key);
    if (pending) return pending;
    const generation = this.generation;
    const task = Promise.resolve()
      .then(read)
      .then((value) => {
        if (generation !== this.generation)
          throw new DOMException('图片读取已取消', 'AbortError');
        this.put(key, value);
        return value;
      })
      .finally(() => {
        if (this.pending.get(key) === task) this.pending.delete(key);
      });
    this.pending.set(key, task);
    return task;
  }

  private put(key: string, value: RepositoryImage) {
    const size = value.content.length * 2;
    if (size > this.limit) return;
    while (this.bytes + size > this.limit && this.values.size) {
      const oldest = this.values.keys().next().value!;
      this.bytes -= this.values.get(oldest)!.content.length * 2;
      this.values.delete(oldest);
    }
    this.values.set(key, value);
    this.bytes += size;
  }

  clear() {
    this.generation++;
    this.values.clear();
    this.pending.clear();
    this.bytes = 0;
  }
}
