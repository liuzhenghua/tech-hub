import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: 'src',
  base: './',
  publicDir: '../public',
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./src/index.html', import.meta.url)),
        ...Object.fromEntries(
          ['json', 'markdown', 'jwt', 'digest', 'strings', 'crypto', 'pdf'].map(
            (name) => [
              name,
              fileURLToPath(
                new URL(`./src/tools/${name}/index.html`, import.meta.url),
              ),
            ],
          ),
        ),
      },
    },
  },
});
