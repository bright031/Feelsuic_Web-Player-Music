import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '~': resolve(dirname(fileURLToPath(import.meta.url))), // Cho phép import từ root
    },
  },
});