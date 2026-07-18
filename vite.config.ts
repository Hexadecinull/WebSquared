import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Only the main SPA is built by Vite. The worker scripts (service worker +
// the client injected into every proxied page) are bundled separately by
// esbuild as standalone IIFEs — see scripts/build-workers.mjs. Building them
// through Vite's multi-entry rollup pipeline used to split out a shared
// chunk (src/shared/url.ts) that both worker files imported via a bare
// `import` statement. That's fine when loaded as `<script type="module">`,
// but the HTML rewriter inlines w2-client.js directly into a classic
// (non-module) <script> tag on every proxied page, and a top-level `import`
// inside a classic script is a hard syntax error — this was the cause of
// "import declarations may only appear at top level of a module" showing up
// on every proxied page. Bundling as an IIFE means each worker file is fully
// self-contained with zero import/export statements.
export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    proxy: {
      '/w2': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
      '/wisp': {
        target: 'ws://localhost:3000',
        ws: true,
      },
      '/w2-presence': {
        target: 'ws://localhost:3000',
        ws: true,
      },
      '/w2-client.js': 'http://localhost:3000',
      '/w2-sw.js': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        app: 'index.html',
      },
    },
  },
});
