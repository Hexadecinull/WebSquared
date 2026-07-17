import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '../../dist');

let cached = '';

try {
  cached = readFileSync(join(DIST_DIR, 'w2-client.js'), 'utf8');
} catch {
  console.warn('[w2] Could not inline w2-client.js — falling back to <script src>');
}

export function getInlineClientScript(): string {
  return cached;
}
