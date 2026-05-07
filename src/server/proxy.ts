import type { Request, Response } from 'express';
import { fromProxyPath, toProxyUrl, PREFIX } from '../shared/url.js';
import { rewriteHtml } from './rewrite/html.js';
import { rewriteCss } from './rewrite/css.js';

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
]);

const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'accept-encoding',
  'cache-control',
  'pragma',
];

function buildRequestHeaders(req: Request, targetUrl: string): Record<string, string> {
  const headers: Record<string, string> = {
    'user-agent':
      (req.headers['user-agent'] as string) ??
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    host: new URL(targetUrl).host,
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
    } catch {
      // ignore malformed referer
    }
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

  const requestHeaders = buildRequestHeaders(req, targetUrl);

  let response: globalThis.Response;
  try {
    response = await fetch(targetUrl, {
      method: req.method,
      headers: requestHeaders,
      redirect: 'follow',
      body:
        req.method !== 'GET' && req.method !== 'HEAD'
          ? (req as unknown as { body: Buffer }).body
          : undefined,
    });
  } catch (err) {
    res.status(502).type('text').send(`Upstream fetch failed: ${(err as Error).message}`);
    return;
  }

  res.status(response.status);

  for (const [key, value] of response.headers.entries()) {
    const lower = key.toLowerCase();
    if (BLOCKED_RESPONSE_HEADERS.has(lower)) continue;

    if (lower === 'location') {
      res.setHeader('location', toProxyUrl(value, response.url));
      continue;
    }

    if (lower === 'set-cookie') {
      const rewritten = value
        .split(', ')
        .map((cookie) =>
          cookie
            .replace(/;\s*domain=[^;]*/gi, '')
            .replace(/;\s*samesite=[^;]*/gi, '')
            .replace(/;\s*secure/gi, ''),
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
  const finalUrl = response.url;

  if (contentType.includes('text/html')) {
    const html = await response.text();
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.removeHeader('content-encoding');
    res.removeHeader('content-length');
    res.send(rewriteHtml(html, finalUrl));
    return;
  }

  if (contentType.includes('text/css')) {
    const css = await response.text();
    res.setHeader('content-type', contentType);
    res.removeHeader('content-encoding');
    res.removeHeader('content-length');
    res.send(rewriteCss(css, finalUrl));
    return;
  }

  const buffer = await response.arrayBuffer();
  res.send(Buffer.from(buffer));
}
