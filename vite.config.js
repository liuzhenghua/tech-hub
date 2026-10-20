import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: 'src',
  base: './',
  publicDir: '../public',
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { outDir: '../dist', emptyOutDir: true },
});
