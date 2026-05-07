import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { OutputChunk } from 'rollup';

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
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        app: 'index.html',
        'w2-sw': 'src/worker/sw.ts',
        'w2-client': 'src/worker/client.ts',
      },
      output: {
        entryFileNames: (chunk: OutputChunk) => {
          if (chunk.name === 'w2-sw' || chunk.name === 'w2-client') {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
