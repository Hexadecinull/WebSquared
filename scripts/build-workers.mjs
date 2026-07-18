import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'dist');

mkdirSync(outDir, { recursive: true });

const targets = [
  { in: 'src/worker/client.ts', out: 'w2-client.js' },
  { in: 'src/worker/sw.ts', out: 'w2-sw.js' },
];

for (const t of targets) {
  await build({
    entryPoints: [join(root, t.in)],
    outfile: join(outDir, t.out),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    logLevel: 'info',
  });
}

console.log('[build-workers] w2-client.js and w2-sw.js bundled as standalone IIFEs.');
