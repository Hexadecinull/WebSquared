import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

// Only the main SPA is built by Vite. The worker scripts (service worker +
// the client injected into every proxied page) are bundled separately by
// esbuild as standalone IIFEs (see scripts/build-workers.mjs) — they get
// inlined into classic <script> tags, which can't contain import/export.
export default defineConfig({
  plugins: [svelte()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
