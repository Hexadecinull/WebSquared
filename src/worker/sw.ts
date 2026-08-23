import { PREFIX, toProxyUrl, fromProxyPath } from '../shared/url';

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// The requesting client's own URL is tried first, since the proxied iframe loads with referrerpolicy="no-referrer" so Referer is absent on most subresource requests, which used to leave them unproxied and slow (or stuck) until some other patched call happened to touch the same URL.
async function resolveRealBase(event: FetchEvent, req: Request): Promise<string | null> {
  const clientId = event.clientId || event.resultingClientId;
  if (clientId) {
    try {
      const client = await self.clients.get(clientId);
      if (client?.url) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname.startsWith(PREFIX)) return fromProxyPath(clientUrl.pathname);
      }
    } catch { /* fall through to the referrer below */ }
  }

  const referer = req.referrer;
  if (!referer) return null;
  try {
    const refUrl = new URL(referer);
    if (!refUrl.pathname.startsWith(PREFIX)) return null;
    return fromProxyPath(refUrl.pathname);
  } catch {
    return null;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.pathname.startsWith(PREFIX)) return;
  if (
    url.origin === self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/w2-sw.js') ||
    url.pathname.startsWith('/w2-client.js')
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      const realBase = await resolveRealBase(event, req);
      if (!realBase) return fetch(req);
      return fetch(toProxyUrl(url.href, realBase), {
        method: req.method,
        headers: req.headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
        credentials: 'omit',
      });
    })(),
  );
});
