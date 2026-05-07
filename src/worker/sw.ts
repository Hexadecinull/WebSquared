import { PREFIX, toProxyUrl, fromProxyPath } from '../shared/url';

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.pathname.startsWith(PREFIX)) {
    return;
  }

  const referer = req.referrer;
  if (!referer) return;

  let refUrl: URL;
  try {
    refUrl = new URL(referer);
  } catch {
    return;
  }

  if (!refUrl.pathname.startsWith(PREFIX)) return;

  let realBase: string;
  try {
    realBase = fromProxyPath(refUrl.pathname);
  } catch {
    return;
  }

  if (
    url.origin === self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/w2-sw.js') ||
    url.pathname.startsWith('/w2-client.js')
  ) {
    return;
  }

  const proxied = toProxyUrl(url.href, realBase);

  event.respondWith(
    fetch(proxied, {
      method: req.method,
      headers: req.headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      credentials: 'omit',
    }),
  );
});
