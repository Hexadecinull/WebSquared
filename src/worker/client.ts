import { toProxyUrl, fromProxyPath, PREFIX } from '../shared/url';

const w = window as Window & typeof globalThis & {
  __W2_URL__: string;
  __W2_PREFIX__: string;
  XMLHttpRequest: typeof XMLHttpRequest;
  WebSocket: typeof WebSocket;
  fetch: typeof fetch;
};

const realUrl: string = w.__W2_URL__ ?? location.href;
const realOrigin = new URL(realUrl).origin;

function isExternal(url: string): boolean {
  try {
    const parsed = new URL(url, realUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (parsed.href.startsWith(location.origin + PREFIX)) return false;
    return true;
  } catch {
    return false;
  }
}

function maybeProxy(url: string): string {
  if (!isExternal(url)) return url;
  return toProxyUrl(url, realUrl);
}

const _fetch = window.fetch.bind(window);
w.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === 'string') {
    return _fetch(maybeProxy(input), init);
  }
  if (input instanceof URL) {
    return _fetch(new URL(maybeProxy(input.href), location.href), init);
  }
  const proxied = maybeProxy(input.url);
  return _fetch(proxied === input.url ? input : new Request(proxied, input), init);
};

const NativeXHR = w.XMLHttpRequest;
class PatchedXHR extends NativeXHR {
  open(
    method: string,
    url: string | URL,
    async: boolean = true,
    user?: string | null,
    password?: string | null,
  ): void {
    const strUrl = typeof url === 'string' ? url : url.href;
    super.open(method, maybeProxy(strUrl), async, user, password);
  }
}
w.XMLHttpRequest = PatchedXHR;

const NativeWS = w.WebSocket;
class PatchedWebSocket extends NativeWS {
  constructor(url: string | URL, protocols?: string | string[]) {
    const strUrl = typeof url === 'string' ? url : url.href;
    super(strUrl, protocols);
  }
}
w.WebSocket = PatchedWebSocket;

const _open = window.open.bind(window);
window.open = function (
  url?: string | URL,
  target?: string,
  features?: string,
): WindowProxy | null {
  if (!url) return _open(url, target, features);
  const strUrl = typeof url === 'string' ? url : url.href;
  return _open(maybeProxy(strUrl), target, features);
};

const _historyPush = history.pushState.bind(history);
history.pushState = function (
  data: unknown,
  unused: string,
  url?: string | URL | null,
): void {
  if (url) {
    const strUrl = typeof url === 'string' ? url : url.href;
    _historyPush(data, unused, maybeProxy(strUrl));
    return;
  }
  _historyPush(data, unused, url);
};

const _historyReplace = history.replaceState.bind(history);
history.replaceState = function (
  data: unknown,
  unused: string,
  url?: string | URL | null,
): void {
  if (url) {
    const strUrl = typeof url === 'string' ? url : url.href;
    _historyReplace(data, unused, maybeProxy(strUrl));
    return;
  }
  _historyReplace(data, unused, url);
};

try {
  const realHrefDesc = {
    get(): string {
      const path = location.pathname;
      if (path.startsWith(PREFIX)) {
        try {
          return fromProxyPath(path) + location.search + location.hash;
        } catch {
          return realUrl;
        }
      }
      return location.href;
    },
    set(value: string): void {
      location.href = maybeProxy(value);
    },
    configurable: true,
  };

  const realHostnameDesc = {
    get(): string {
      return new URL(realUrl).hostname;
    },
    configurable: true,
  };

  const realOriginDesc = {
    get(): string {
      return realOrigin;
    },
    configurable: true,
  };

  Object.defineProperties(window, {
    '__w2_realHref': realHrefDesc,
    '__w2_realHostname': realHostnameDesc,
    '__w2_realOrigin': realOriginDesc,
  });
} catch {
  // location override is best-effort
}
