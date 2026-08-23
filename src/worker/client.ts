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

interface DevtoolsConsoleEntry { type: string; args: string[]; time: number }
interface DevtoolsNetworkEntry {
  method: string;
  url: string;
  status: number | null;
  time: number;
  duration: number | null;
  initiator: string;
}

const devtoolsLog = {
  console: [] as DevtoolsConsoleEntry[],
  network: [] as DevtoolsNetworkEntry[],
};
(window as unknown as Record<string, unknown>)['__w2_devtools'] = devtoolsLog;

const MAX_LOG_ENTRIES = 300;

function stringifyArg(a: unknown): string {
  if (typeof a === 'string') return a;
  try { return JSON.stringify(a); } catch { return String(a); }
}

function pushConsole(type: string, args: string[]) {
  devtoolsLog.console.push({ type, args, time: Date.now() });
  if (devtoolsLog.console.length > MAX_LOG_ENTRIES) devtoolsLog.console.shift();
}

for (const method of ['log', 'warn', 'error', 'info'] as const) {
  const native = console[method].bind(console);
  console[method] = (...args: unknown[]) => {
    pushConsole(method, args.map(stringifyArg));
    native(...args);
  };
}

// These listeners keep catching uncaught errors even if the page's own scripts later replace console.error.
window.addEventListener('error', (e) => {
  pushConsole('error', [e.message || 'Uncaught error', e.filename ? `(${e.filename}:${e.lineno})` : '']);
});
window.addEventListener('unhandledrejection', (e) => {
  pushConsole('error', ['Unhandled promise rejection:', stringifyArg(e.reason)]);
});

function logNetwork(method: string, url: string, status: number | null, duration: number | null, initiator: string) {
  devtoolsLog.network.push({ method, url, status, time: Date.now(), duration, initiator });
  if (devtoolsLog.network.length > MAX_LOG_ENTRIES) devtoolsLog.network.shift();
}

// fetch/XHR patches below only see requests JS explicitly makes; Resource Timing is used here too, to also capture images, stylesheets, scripts, and fonts loaded straight from HTML/CSS.
try {
  const seenEntries = new Set<string>();
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const r = entry as PerformanceResourceTiming;
      if (r.initiatorType === 'fetch' || r.initiatorType === 'xmlhttprequest') continue;
      const key = `${r.name}:${r.startTime}`;
      if (seenEntries.has(key)) continue;
      seenEntries.add(key);
      const status = (r as unknown as { responseStatus?: number }).responseStatus ?? null;
      logNetwork('GET', r.name, status, Math.round(r.duration), r.initiatorType || 'other');
    }
  });
  observer.observe({ type: 'resource', buffered: true });
} catch { /* PerformanceObserver not available */ }

const _fetch = window.fetch.bind(window);
window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
  const started = Date.now();
  const proxied = maybeProxy(url);
  const target =
    typeof input === 'string' ? proxied
    : input instanceof URL ? proxied
    : proxied === input.url ? input : new Request(proxied, input);
  return _fetch(target as RequestInfo, init).then(
    (res) => { logNetwork(method, url, res.status, Date.now() - started, 'fetch'); return res; },
    (err) => { logNetwork(method, url, null, Date.now() - started, 'fetch'); throw err; },
  );
};

const NativeXHR = window.XMLHttpRequest;
class PatchedXHR extends NativeXHR {
  private _w2Method = 'GET';
  private _w2Url = '';
  private _w2Start = 0;

  open(
    method: string,
    url: string | URL,
    async = true,
    user?: string | null,
    password?: string | null,
  ): void {
    const strUrl = typeof url === 'string' ? url : url.href;
    this._w2Method = method;
    this._w2Url = strUrl;
    super.open(method, maybeProxy(strUrl), async, user, password);
  }

  send(body?: Document | XMLHttpRequestBodyInit | null): void {
    this._w2Start = Date.now();
    this.addEventListener('loadend', () => {
      logNetwork(this._w2Method, this._w2Url, this.status || null, Date.now() - this._w2Start, 'xhr');
    });
    super.send(body);
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

// Rewrites src/href set programmatically after page load, not just what was present in the server-rendered HTML.
function patchUrlProperty(ctor: { prototype: object } | undefined, prop: string) {
  if (!ctor) return;
  const descriptor = Object.getOwnPropertyDescriptor(ctor.prototype, prop);
  if (!descriptor?.get || !descriptor?.set) return;
  Object.defineProperty(ctor.prototype, prop, {
    configurable: true,
    enumerable: descriptor.enumerable,
    get(this: unknown) { return descriptor.get!.call(this); },
    set(this: unknown, value: string) { descriptor.set!.call(this, maybeProxy(String(value))); },
  });
}

patchUrlProperty(window.HTMLImageElement, 'src');
patchUrlProperty(window.HTMLScriptElement, 'src');
patchUrlProperty(window.HTMLLinkElement, 'href');
patchUrlProperty(window.HTMLIFrameElement, 'src');
patchUrlProperty(window.HTMLAnchorElement, 'href');

const URL_ATTR_TAGS: Record<string, string> = {
  IMG: 'src',
  SCRIPT: 'src',
  LINK: 'href',
  IFRAME: 'src',
  A: 'href',
};

const _setAttribute = Element.prototype.setAttribute;
Element.prototype.setAttribute = function (name: string, value: string): void {
  const expected = URL_ATTR_TAGS[this.tagName];
  if (expected && expected === name.toLowerCase()) {
    _setAttribute.call(this, name, maybeProxy(value));
    return;
  }
  _setAttribute.call(this, name, value);
};

// A same-origin iframe means window.top/parent are real, readable references to WebSquared's own top window, which some sites use to detect framing and force-navigate top.location to their real domain; this makes the page think it was never framed in the first place.
try {
  Object.defineProperty(window, 'top', { get() { return window; }, configurable: true });
  Object.defineProperty(window, 'parent', { get() { return window; }, configurable: true });
  Object.defineProperty(window, 'frameElement', { get() { return null; }, configurable: true });
} catch { /* some browsers make these non-configurable; best-effort */ }

// Set-Cookie headers already get Domain/Path normalized server-side, but document.cookie set straight from JS bypasses that, which is why cookie consent, logins, and similar state kept resetting on every visit.
try {
  const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  if (cookieDescriptor?.get && cookieDescriptor?.set) {
    Object.defineProperty(Document.prototype, 'cookie', {
      configurable: true,
      get(this: Document) { return cookieDescriptor.get!.call(this); },
      set(this: Document, value: string) {
        const cleaned = String(value).replace(/;\s*domain=[^;]*/gi, '').replace(/;\s*path=[^;]*/gi, '');
        cookieDescriptor.set!.call(this, cleaned);
      },
    });
  }
} catch { /* best-effort */ }

document.addEventListener('click', (e) => {
  const a = (e.target as Element)?.closest('a');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
  // A download link's href is already proxied (server-side rewriting, or
  // the anchor/attribute patches above for JS-created links), so it's
  // same-origin; let the browser's native download behavior handle it
  // instead of navigating the iframe to it.
  if (a.hasAttribute('download')) return;
  const resolved = resolveAgainstReal(href);
  if (!isProxiable(resolved)) return;
  e.preventDefault();
  location.href = toProxyUrl(resolved, realUrl);
}, true);
