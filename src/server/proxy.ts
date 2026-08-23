import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { isIP } from 'node:net';
import { fromProxyPath, toProxyUrl, PREFIX } from '../shared/url.js';
import { rewriteHtml } from './rewrite/html.js';
import { rewriteCss } from './rewrite/css.js';
import { renderSelfLoopPage, renderContentFilterPage } from './rewrite/blocked.js';
import { isAdRequest, respondBlocked } from './rewrite/adblock.js';
import { isBlockedByCategory, type FilterCategory } from './rewrite/blocklists.js';

const BLOCKED_RESPONSE_HEADERS = new Set([
  'content-security-policy',
  'content-security-policy-report-only',
  'x-frame-options',
  'x-content-type-options',
  'strict-transport-security',
  'permissions-policy',
  'cross-origin-embedder-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-headers',
  'access-control-allow-methods',
  'content-length',
  'content-encoding',
  'transfer-encoding',
  'set-cookie',
]);

// Forwarded by blocklist, not allowlist, since sites rely on custom headers; this excludes hop-by-hop headers, computed ones, and IP-leaking proxy metadata.
const REQUEST_HEADER_BLOCKLIST = new Set([
  'host',
  'connection',
  'content-length',
  'cookie',
  'referer',
  'origin',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-worker',
  'cdn-loop',
  'x-request-id',
]);

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const REDIRECT_LIMIT = 5;

// Cookies get namespaced per target origin so different proxied sites don't collide in the browser's one shared cookie jar.
const COOKIE_NS_PREFIX = 'w2c_';

function hashOrigin(origin: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < origin.length; i++) {
    hash ^= origin.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function namespaceSetCookie(setCookieValue: string, nsPrefix: string): string {
  const eqIndex = setCookieValue.indexOf('=');
  if (eqIndex === -1) return setCookieValue;
  return `${nsPrefix}${setCookieValue.slice(0, eqIndex)}${setCookieValue.slice(eqIndex)}`;
}

function buildUpstreamCookieHeader(rawCookieHeader: string | undefined, nsPrefix: string): string | undefined {
  if (!rawCookieHeader) return undefined;
  const matched: string[] = [];
  for (const pair of rawCookieHeader.split(';')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const name = trimmed.slice(0, eqIndex);
    if (name.startsWith(nsPrefix)) {
      matched.push(`${name.slice(nsPrefix.length)}${trimmed.slice(eqIndex)}`);
    }
  }
  return matched.length > 0 ? matched.join('; ') : undefined;
}

function buildRequestHeaders(req: Request, targetUrl: string): Record<string, string> {
  const parsed = new URL(targetUrl);
  const headers: Record<string, string> = {};

  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    const lower = key.toLowerCase();
    if (REQUEST_HEADER_BLOCKLIST.has(lower)) continue;
    headers[lower] = Array.isArray(value) ? value.join(', ') : value;
  }

  headers['host'] = parsed.host;
  headers['origin'] = parsed.origin;
  if (!headers['user-agent']) headers['user-agent'] = DEFAULT_USER_AGENT;

  const nsPrefix = `${COOKIE_NS_PREFIX}${hashOrigin(parsed.origin)}_`;
  const upstreamCookie = buildUpstreamCookieHeader(req.headers['cookie'] as string | undefined, nsPrefix);
  if (upstreamCookie) headers['cookie'] = upstreamCookie;

  const rawReferer = req.headers['referer'] as string | undefined;
  if (rawReferer) {
    try {
      const refUrl = new URL(rawReferer);
      if (refUrl.pathname.startsWith(PREFIX)) {
        headers['referer'] = fromProxyPath(refUrl.pathname);
      }
    } catch { /* ignore */ }
  }

  return headers;
}

function getRequestBody(req: Request): Buffer | undefined {
  const body = (req as unknown as { body?: unknown }).body;
  if (Buffer.isBuffer(body) && body.length > 0) return body;
  return undefined;
}

// Blocks obvious attempts to reach internal network addresses; hostname-pattern based, so it stops naive attempts but not a determined DNS-rebinding attack.
const PRIVATE_IPV4_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
];

const PRIVATE_IPV6_PATTERNS = [
  /^::1$/,
  /^::$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd00:/i,
];

function isPrivateIPv4(addr: string): boolean {
  return PRIVATE_IPV4_PATTERNS.some((re) => re.test(addr));
}

// Node/the WHATWG URL parser canonicalizes IPv4-mapped IPv6 addresses like ::ffff:127.0.0.1 into hex form (::ffff:7f00:1); this decodes that back into IPv4 octets so it hits the same private-range check as any other IPv4 address.
function extractMappedIPv4(addr: string): string | null {
  const match = addr.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!match) return null;
  const hi = parseInt(match[1], 16);
  const lo = parseInt(match[2], 16);
  return [(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255].join('.');
}

// Hostname-pattern based, not DNS-resolution based, using Node's own IP classification so IPv6 literals (bracketed and IPv4-mapped forms included) are handled correctly, not just IPv4.
function isPrivateHostname(rawHostname: string): boolean {
  const hostname = rawHostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;

  if (isIP(hostname) === 4) return isPrivateIPv4(hostname);

  if (isIP(hostname) === 6) {
    const mapped = extractMappedIPv4(hostname);
    if (mapped) return isPrivateIPv4(mapped);
    return PRIVATE_IPV6_PATTERNS.some((re) => re.test(hostname));
  }

  return false;
}

// The client's settings live in localStorage, so anything enforced here rides along as a plain, unnamespaced cookie on the top-level page instead (see App.svelte's settings-to-cookie sync).
function readFlagCookie(rawCookieHeader: string | undefined, name: string): boolean {
  if (!rawCookieHeader) return false;
  return rawCookieHeader.split(';').some((pair) => pair.trim() === `${name}=1`);
}

const CATEGORY_COOKIES: Record<FilterCategory, string> = {
  adult: 'w2_block_adult',
  gambling: 'w2_block_gambling',
  malware: 'w2_block_malware',
};

// Caps how much of a text response gets buffered for HTML/CSS rewriting, so a hostile or compromised upstream can't exhaust server memory with an oversized (or decompression-bomb) body; binary responses are streamed straight through instead and never hit this.
const MAX_REWRITE_BODY_BYTES = 25 * 1024 * 1024;

async function readTextWithLimit(response: globalThis.Response, limit: number): Promise<string | null> {
  if (!response.body) return await response.text();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.length;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

export async function handleProxy(req: Request, res: Response): Promise<void> {
  const encodedPart = req.path.slice(1);

  let targetUrl: string;
  try {
    targetUrl = fromProxyPath(encodedPart);
  } catch {
    res.status(400).type('text').send('Invalid proxy path encoding.');
    return;
  }

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    res.status(400).type('text').send('Decoded value is not a valid URL.');
    return;
  }

  // A GET <form> appends its own query string onto the proxied action URL, landing on our path rather than inside the encoded blob; re-attaching it here is what makes search boxes actually search instead of just reloading the homepage.
  const rawQuery = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '';
  if (rawQuery) {
    parsedTarget.search = parsedTarget.search ? `${parsedTarget.search}&${rawQuery}` : `?${rawQuery}`;
  }

  if (parsedTarget.protocol === 'http:') parsedTarget.protocol = 'https:';
  if (parsedTarget.protocol !== 'https:') {
    res.status(400).type('text').send('Only HTTP(S) targets are allowed.');
    return;
  }

  if (isPrivateHostname(parsedTarget.hostname)) {
    res.status(403).type('text').send('Proxying to private or internal addresses is not allowed.');
    return;
  }

  targetUrl = parsedTarget.href;

  if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
    res.status(400).type('text').send('Only http and https targets are supported.');
    return;
  }

  if (isPrivateHostname(parsedTarget.hostname)) {
    res.status(403).type('text').send('Proxying to private or internal addresses is not allowed.');
    return;
  }

  if (parsedTarget.protocol === 'http:') {
    parsedTarget.protocol = 'https:';
    targetUrl = parsedTarget.href;
  }

  const requestHost = (req.headers['host'] as string | undefined)?.toLowerCase();
  if (requestHost && parsedTarget.host.toLowerCase() === requestHost) {
    res.status(200).type('html').send(renderSelfLoopPage());
    return;
  }

  if (readFlagCookie(req.headers['cookie'] as string | undefined, 'w2_block_ads') && isAdRequest(parsedTarget)) {
    respondBlocked(req, res, targetUrl);
    return;
  }

  const isDocumentRequest = (req.headers['sec-fetch-dest'] as string | undefined ?? 'document') === 'document';
  const rawCookie = req.headers['cookie'] as string | undefined;
  for (const category of Object.keys(CATEGORY_COOKIES) as FilterCategory[]) {
    if (!readFlagCookie(rawCookie, CATEGORY_COOKIES[category])) continue;
    if (!isBlockedByCategory(parsedTarget.hostname, category)) continue;
    if (isDocumentRequest) {
      res.status(200).type('html').send(renderContentFilterPage(category, parsedTarget.hostname));
    } else {
      respondBlocked(req, res, targetUrl);
    }
    return;
  }

  let requestHeaders = buildRequestHeaders(req, targetUrl);
  let response: globalThis.Response;
  let redirectCount = 0;
  let currentUrl = targetUrl;

  while (true) {
    try {
      response = await fetch(currentUrl, {
        method: req.method,
        headers: requestHeaders,
        redirect: 'manual',
        body: req.method !== 'GET' && req.method !== 'HEAD' ? getRequestBody(req) : undefined,
      });
    } catch (err) {
      res.status(502).type('text').send(`Upstream fetch failed: ${(err as Error).message}`);
      return;
    }

    const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
    if (isRedirect && redirectCount < REDIRECT_LIMIT) {
      const location = response.headers.get('location');
      if (!location) break;
      try {
        const next = new URL(location, currentUrl);
        if (next.protocol === 'http:') next.protocol = 'https:';

        if (requestHost && next.host.toLowerCase() === requestHost) {
          res.status(200).type('html').send(renderSelfLoopPage());
          return;
        }

        if (isPrivateHostname(next.hostname)) {
          res.status(403).type('text').send('Proxying to private or internal addresses is not allowed.');
          return;
        }

        if (readFlagCookie(rawCookie, 'w2_block_ads') && isAdRequest(next)) {
          respondBlocked(req, res, next.href);
          return;
        }

        for (const category of Object.keys(CATEGORY_COOKIES) as FilterCategory[]) {
          if (!readFlagCookie(rawCookie, CATEGORY_COOKIES[category])) continue;
          if (!isBlockedByCategory(next.hostname, category)) continue;
          if (isDocumentRequest) {
            res.status(200).type('html').send(renderContentFilterPage(category, next.hostname));
          } else {
            respondBlocked(req, res, next.href);
          }
          return;
        }

        currentUrl = next.href;
        redirectCount++;
        requestHeaders = buildRequestHeaders(req, currentUrl);
        continue;
      } catch { break; }
    }
    break;
  }

  const finalUrl = currentUrl;
  res.status(response.status);

  for (const [key, value] of response.headers.entries()) {
    const lower = key.toLowerCase();
    if (BLOCKED_RESPONSE_HEADERS.has(lower)) continue;

    if (lower === 'location') {
      res.setHeader('location', toProxyUrl(value, finalUrl));
      continue;
    }

    res.setHeader(key, value);
  }

  const setCookies = response.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    const nsPrefix = `${COOKIE_NS_PREFIX}${hashOrigin(new URL(finalUrl).origin)}_`;
    const rewritten = setCookies.map((cookie) => {
      // Path is forced to "/" too, not just stripped, since our flat /w2/<blob> URLs have no correspondence to the original site's path hierarchy; a cookie left scoped to "/login" would never come back on any other proxied page, which is why things like cookie-consent choices kept resetting.
      const stripped = cookie
        .replace(/;\s*domain=[^;]*/gi, '')
        .replace(/;\s*samesite=[^;]*/gi, '')
        .replace(/;\s*path=[^;]*/gi, '');
      return `${namespaceSetCookie(stripped, nsPrefix)}; Path=/`;
    });
    res.setHeader('set-cookie', rewritten);
  }

  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-credentials', 'true');

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('text/html')) {
    const html = await readTextWithLimit(response, MAX_REWRITE_BODY_BYTES);
    if (html === null) {
      res.status(502).type('text').send('Upstream response was too large to process.');
      return;
    }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.send(rewriteHtml(html, finalUrl));
    return;
  }

  if (contentType.includes('text/css')) {
    const css = await readTextWithLimit(response, MAX_REWRITE_BODY_BYTES);
    if (css === null) {
      res.status(502).type('text').send('Upstream response was too large to process.');
      return;
    }
    res.setHeader('content-type', contentType);
    res.send(rewriteCss(css, finalUrl));
    return;
  }

  if (response.body) {
    res.setHeader('content-type', contentType || 'application/octet-stream');
    Readable.fromWeb(response.body as import('stream/web').ReadableStream<Uint8Array>).pipe(res);
    return;
  }

  res.end();
}
