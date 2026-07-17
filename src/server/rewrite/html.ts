import { load } from 'cheerio';
import { toProxyUrl, PREFIX } from '../../shared/url.js';
import { rewriteCss } from './css.js';
import { getInlineClientScript } from '../client-cache.js';

const TAG_ATTRS: Record<string, string[]> = {
  a: ['href'],
  link: ['href'],
  script: ['src'],
  img: ['src'],
  source: ['src'],
  video: ['src', 'poster'],
  audio: ['src'],
  iframe: ['src'],
  embed: ['src'],
  form: ['action'],
  object: ['data'],
  input: ['src'],
  blockquote: ['cite'],
  del: ['cite'],
  ins: ['cite'],
  q: ['cite'],
  track: ['src'],
  area: ['href'],
  use: ['href', 'xlink:href'],
};

const SKIP_PROTOCOLS = new Set(['data:', 'blob:', 'javascript:', 'mailto:', 'tel:', '#']);

function shouldSkip(url: string): boolean {
  if (url.startsWith(PREFIX)) return true;
  for (const proto of SKIP_PROTOCOLS) {
    if (url.startsWith(proto)) return true;
  }
  return false;
}

function upgradeUrl(url: string): string {
  return url.startsWith('http://') ? url.replace('http://', 'https://') : url;
}

function rewriteSrcset(srcset: string, base: string): string {
  return srcset
    .split(',')
    .map((entry) => {
      const parts = entry.trim().split(/\s+/);
      if (!parts[0]) return entry;
      parts[0] = shouldSkip(parts[0]) ? parts[0] : toProxyUrl(upgradeUrl(parts[0]), base);
      return parts.join(' ');
    })
    .join(', ');
}

function resolveBase(html: string, base: string): string {
  const match = html.match(/<base[^>]+href=["']?([^"'\s>]+)/i);
  if (match) {
    try { return new URL(match[1], base).href; } catch { return base; }
  }
  return base;
}

export function rewriteHtml(html: string, baseUrl: string): string {
  const resolvedBase = resolveBase(html, baseUrl);
  const $ = load(html, { xmlMode: false });

  $('meta[http-equiv="Content-Security-Policy"]').remove();
  $('meta[http-equiv="content-security-policy"]').remove();
  $('meta[http-equiv="X-Frame-Options"]').remove();
  $('meta[http-equiv="refresh"]').remove();
  $('base').remove();

  const inlined = getInlineClientScript();
  const clientTag = inlined
    ? `<script>${inlined}</script>`
    : `<script src="/w2-client.js"></script>`;

  $('head').prepend(
    `<script>window.__W2_URL__="${resolvedBase}";window.__W2_PREFIX__="/w2/";</script>${clientTag}`,
  );

  for (const [tag, attrs] of Object.entries(TAG_ATTRS)) {
    $(tag).each((_, el) => {
      const element = $(el);
      const target = element.attr('target');
      if (target === '_top' || target === '_parent' || target === '_blank') {
        element.attr('target', '_self');
      }
      for (const attr of attrs) {
        const val = element.attr(attr);
        if (val && !shouldSkip(val)) {
          element.attr(attr, toProxyUrl(upgradeUrl(val), resolvedBase));
        }
      }
    });
  }

  $('[srcset]').each((_, el) => {
    const element = $(el);
    const srcset = element.attr('srcset');
    if (srcset) element.attr('srcset', rewriteSrcset(srcset, resolvedBase));
  });

  $('[style]').each((_, el) => {
    const element = $(el);
    const style = element.attr('style');
    if (style) element.attr('style', rewriteCss(style, resolvedBase));
  });

  $('style').each((_, el) => {
    const element = $(el);
    const content = element.html();
    if (content) element.html(rewriteCss(content, resolvedBase));
  });

  return $.html();
}
