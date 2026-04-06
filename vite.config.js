import { defineConfig } from 'vite';

export default defineConfig({
  // Use relative base path so it works on GitHub Pages subdirectories
  base: './',
  build: {
      outDir: 'dist',
  },
});
