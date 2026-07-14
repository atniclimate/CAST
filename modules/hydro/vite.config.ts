import { defineConfig } from 'vite';

export default defineConfig({
  // Serverless-static first: relative base so the build works from any
  // CDN path or as an embedded folder on the ATNI site.
  base: './',
});
