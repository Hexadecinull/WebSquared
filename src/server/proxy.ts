import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { fromProxyPath, toProxyUrl, PREFIX } from '../shared/url.js';
import { rewriteHtml } from './rewrite/html.js';
import { rewriteCss } from './rewrite/css.js';
import { renderSelfLoopPage } from './rewrite/blocked.js';

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

// Forwarded by blocklist, not allowlist: sites rely on custom headers
// (RSC routing, CSRF tokens, range requests, sec-fetch-*, etc). This list
// excludes hop-by-hop headers, ones we compute ourselves, and reverse-proxy
// metadata that would otherwise leak the visitor's real IP.
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

// Cookies get namespaced per target origin so different proxied sites
// don't collide in the browser's one shared cookie jar.
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

// Blocks obvious attempts to make the server reach its own internal
// network (loopback, RFC1918 private ranges, link-local, cloud metadata
// endpoints). Hostname-pattern based, not DNS-resolution based — it stops
// naive attempts but not a determined DNS-rebinding attack.
const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
  /^\[?fc00:/i,
  /^\[?fd00:/i,
];

function isPrivateHostname(hostname: string): boolean {
  return PRIVATE_HOSTNAME_PATTERNS.some((re) => re.test(hostname));
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
      const stripped = cookie
        .replace(/;\s*domain=[^;]*/gi, '')
        .replace(/;\s*samesite=[^;]*/gi, '');
      return namespaceSetCookie(stripped, nsPrefix);
    });
    res.setHeader('set-cookie', rewritten);
  }

  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-credentials', 'true');

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('text/html')) {
    const html = await response.text();
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.send(rewriteHtml(html, finalUrl));
    return;
  }

  if (contentType.includes('text/css')) {
    const css = await response.text();
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
