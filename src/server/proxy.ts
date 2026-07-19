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
  // These describe the framing of the UPSTREAM response body. Once we've
  // buffered/decoded that body (fetch() transparently decompresses gzip/br)
  // or are about to stream the raw bytes ourselves, forwarding the
  // original values causes the browser to expect a different byte count
  // or encoding than what actually arrives — this is what makes pages hang
  // "loading" forever or silently truncate.
  'content-length',
  'content-encoding',
  'transfer-encoding',
  // Handled separately via getSetCookie() below, never via .entries().
  'set-cookie',
]);

const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'accept-encoding',
  'cache-control',
  'pragma',
];

const REDIRECT_LIMIT = 5;

// All proxied sites share this one real domain, so their cookies would
// otherwise collide in the browser's single cookie jar (a "session" cookie
// from google.com and one from bing.com would overwrite each other). Every
// cookie we hand back to the browser gets its name prefixed with a short
// tag derived from the target's origin, and stripped back off before we
// forward it to that same origin on later requests — invisible to both the
// browser's UI and the target site, but keeps origins fully isolated.
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
  const name = setCookieValue.slice(0, eqIndex);
  const rest = setCookieValue.slice(eqIndex);
  return `${nsPrefix}${name}${rest}`;
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
  const headers: Record<string, string> = {
    'user-agent':
      (req.headers['user-agent'] as string) ??
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    host: parsed.host,
    origin: parsed.origin,
  };

  for (const name of FORWARDED_REQUEST_HEADERS) {
    const val = req.headers[name];
    if (val) headers[name] = val as string;
  }

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

  if (parsedTarget.protocol === 'http:') {
    parsedTarget.protocol = 'https:';
    targetUrl = parsedTarget.href;
  }

  // Self-loop guard: block proxying our own domain through itself. Without
  // this, navigating (or being redirected) to the proxy's own address inside
  // the iframe embeds a full nested copy of WebSquared, which can itself be
  // navigated to itself again — a pointless, resource-wasting recursion.
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
        body:
          req.method !== 'GET' && req.method !== 'HEAD'
            ? (req as unknown as { body: Buffer }).body
            : undefined,
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

        // Same guard applies mid-redirect-chain: a target site could bounce
        // us back to our own domain just as easily as a typed-in URL could.
        if (requestHost && next.host.toLowerCase() === requestHost) {
          res.status(200).type('html').send(renderSelfLoopPage());
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

  // getSetCookie() returns each Set-Cookie header as its own array entry —
  // unlike iterating .entries(), which can coalesce multiple Set-Cookie
  // headers into one comma-joined string. That's unsafe for cookies
  // specifically, since a cookie's own Expires attribute can legitimately
  // contain a comma (e.g. "Expires=Wed, 21 Oct 2026 07:28:00 GMT"), which a
  // naive comma-split would mistake for a second cookie.
  const setCookies = response.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    const nsPrefix = `${COOKIE_NS_PREFIX}${hashOrigin(new URL(finalUrl).origin)}_`;
    const rewritten = setCookies.map((cookie) => {
      // Strip Domain (cookies should scope to OUR domain, not the target's)
      // and SameSite (the browser's notion of "site" here is our domain, so
      // the original value no longer means what it meant on the real site).
      // Deliberately NOT stripping Secure: our proxy is always served over
      // HTTPS in production, and cookies using the __Secure- / __Host-
      // prefixes are rejected by the browser outright if Secure is missing.
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

  // Everything else (JS, images, fonts, video, JSON, ...) is streamed through
  // untouched rather than buffered fully into memory first. This matters a
  // lot for large payloads (video, big JS bundles): the browser starts
  // receiving bytes immediately instead of waiting for the whole upstream
  // response to land on the server first, and the server doesn't have to
  // hold multi-megabyte buffers in memory per concurrent request.
  if (response.body) {
    res.setHeader('content-type', contentType || 'application/octet-stream');
    Readable.fromWeb(response.body as import('stream/web').ReadableStream<Uint8Array>).pipe(res);
    return;
  }

  res.end();
}
