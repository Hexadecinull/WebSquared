import { toProxyUrl, fromProxyPath, PREFIX } from '../shared/url';

const realUrl: string = (window as unknown as Record<string, string>)['__W2_URL__'] ?? location.href;
const proxyOrigin = location.origin;

function resolveAgainstReal(url: string): string {
  try { return new URL(url, realUrl).href; } catch { return url; }
}

function isProxiable(url: string): boolean {
  try {
    const parsed = new URL(url, realUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (parsed.href.startsWith(proxyOrigin + PREFIX)) return false;
    return true;
  } catch {
    return false;
  }
}

function maybeProxy(url: string): string {
  const resolved = resolveAgainstReal(url);
  if (!isProxiable(resolved)) return url;
  return toProxyUrl(resolved, realUrl);
}

const _fetch = window.fetch.bind(window);
window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === 'string') return _fetch(maybeProxy(input), init);
  if (input instanceof URL) return _fetch(maybeProxy(input.href), init);
  const proxied = maybeProxy(input.url);
  return _fetch(proxied === input.url ? input : new Request(proxied, input), init);
};

const NativeXHR = window.XMLHttpRequest;
class PatchedXHR extends NativeXHR {
  open(
    method: string,
    url: string | URL,
    async = true,
    user?: string | null,
    password?: string | null,
  ): void {
    const strUrl = typeof url === 'string' ? url : url.href;
    super.open(method, maybeProxy(strUrl), async, user, password);
  }
}
(window as unknown as Record<string, unknown>)['XMLHttpRequest'] = PatchedXHR;

const NativeWS = window.WebSocket;
class PatchedWebSocket extends NativeWS {
  constructor(url: string | URL, protocols?: string | string[]) {
    super(typeof url === 'string' ? url : url.href, protocols);
  }
}
(window as unknown as Record<string, unknown>)['WebSocket'] = PatchedWebSocket;

const _open = window.open.bind(window);
window.open = function (url?: string | URL, target?: string, features?: string): WindowProxy | null {
  if (!url) return _open(url, target, features);
  return _open(maybeProxy(typeof url === 'string' ? url : url.href), target, features);
};

const _push = history.pushState.bind(history);
history.pushState = function (data: unknown, unused: string, url?: string | URL | null): void {
  if (!url) { _push(data, unused, url); return; }
  _push(data, unused, maybeProxy(typeof url === 'string' ? url : url.href));
};

const _replace = history.replaceState.bind(history);
history.replaceState = function (data: unknown, unused: string, url?: string | URL | null): void {
  if (!url) { _replace(data, unused, url); return; }
  _replace(data, unused, maybeProxy(typeof url === 'string' ? url : url.href));
};

try {
  Object.defineProperties(window, {
    '__w2_realHref': {
      get() {
        const path = location.pathname;
        if (path.startsWith(PREFIX)) {
          try { return fromProxyPath(path) + location.search + location.hash; }
          catch { return realUrl; }
        }
        return location.href;
      },
      set(value: string) { location.href = maybeProxy(value); },
      configurable: true,
    },
    '__w2_realOrigin': {
      get() { try { return new URL(realUrl).origin; } catch { return ''; } },
      configurable: true,
    },
  });
} catch { /* best-effort */ }

document.addEventListener('click', (e) => {
  const a = (e.target as Element)?.closest('a');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
  const resolved = resolveAgainstReal(href);
  if (!isProxiable(resolved)) return;
  e.preventDefault();
  location.href = toProxyUrl(resolved, realUrl);
}, true);
