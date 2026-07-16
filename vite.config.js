import { defineConfig } from 'vite';

// Relative base so the built app works on GitHub Pages project sites
// and any static host without path configuration.
export default defineConfig({
  base: './',
});
