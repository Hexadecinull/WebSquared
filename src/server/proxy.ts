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
]);

const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'accept-encoding',
  'cache-control',
  'pragma',
];

const REDIRECT_LIMIT = 5;

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

    if (lower === 'set-cookie') {
      // Strip Domain (cookies should scope to OUR domain, not the target's)
      // and SameSite (the browser's notion of "site" here is our domain, so
      // the original value no longer means what it meant on the real site).
      // Deliberately NOT stripping Secure: our proxy is always served over
      // HTTPS in production, and cookies using the __Secure- / __Host-
      // prefixes are rejected by the browser outright if Secure is missing.
      const rewritten = value
        .split(', ')
        .map((cookie) =>
          cookie
            .replace(/;\s*domain=[^;]*/gi, '')
            .replace(/;\s*samesite=[^;]*/gi, ''),
        )
        .join(', ');
      res.setHeader('set-cookie', rewritten);
      continue;
    }

    res.setHeader(key, value);
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
