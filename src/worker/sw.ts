import { PREFIX, toProxyUrl, fromProxyPath } from '../shared/url';

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// client.url only reflects the URL a client was created with and doesn't update on pushState/replaceState-based SPA navigation, so the client script posts a message here on every such navigation, checked first as the most up-to-date signal, ahead of client.url and the (usually-absent) referrer.
const liveClientUrls = new Map<string, string>();
const MAX_TRACKED_CLIENTS = 200;

self.addEventListener('message', (event) => {
  const data = event.data as { type?: string; url?: string } | undefined;
  if (data?.type !== 'w2-url-update' || typeof data.url !== 'string') return;
  const clientId = (event.source as Client | null)?.id;
  if (!clientId) return;
  liveClientUrls.delete(clientId);
  liveClientUrls.set(clientId, data.url);
  // Cheap cap instead of tracking client teardown: evicts the least
  // recently updated entry first, since re-setting a key above moves it to
  // the end of Map's insertion order.
  if (liveClientUrls.size > MAX_TRACKED_CLIENTS) {
    const oldest = liveClientUrls.keys().next().value;
    if (oldest) liveClientUrls.delete(oldest);
  }
});

// The requesting client's own URL is tried first, since the proxied iframe loads with referrerpolicy="no-referrer" so Referer is absent on most subresource requests, which used to leave them unproxied and slow (or stuck) until some other patched call happened to touch the same URL.
async function resolveRealBase(event: FetchEvent, req: Request): Promise<string | null> {
  const clientId = event.clientId || event.resultingClientId;
  if (clientId) {
    const live = liveClientUrls.get(clientId);
    if (live) return live;

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
