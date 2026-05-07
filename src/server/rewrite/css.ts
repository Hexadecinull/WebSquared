import { toProxyUrl } from '../../shared/url.js';

const URL_RE = /url\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi;
const IMPORT_RE = /@import\s+(['"])([^'"]+)\1/gi;

export function rewriteCss(css: string, base: string): string {
  return css
    .replace(URL_RE, (_, quote, url: string) => {
      if (url.startsWith('data:') || url.startsWith('#')) {
        return `url(${quote}${url}${quote})`;
      }
      return `url(${quote}${toProxyUrl(url, base)}${quote})`;
    })
    .replace(IMPORT_RE, (_, quote, url: string) => {
      return `@import ${quote}${toProxyUrl(url, base)}${quote}`;
    });
}
