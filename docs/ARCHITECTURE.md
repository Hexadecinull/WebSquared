# Architecture

This document explains how WebSquared actually works internally. If you're
looking to contribute or just curious, start here.

## Overview

```
Browser
  └── Svelte SPA (tabs, toolbar, settings, bookmarks, history)
        └── <iframe> → /w2/<encoded-url>
              └── Express server
                    ├── SSRF / self-loop guards
                    ├── Server-side fetch → target site
                    ├── Per-origin cookie namespacing
                    ├── HTML rewriter (cheerio)
                    ├── CSS rewriter
                    └── Static file server → dist/

Service Worker (/w2-sw.js)
  └── Intercepts JS-initiated external requests from proxied pages

Injected client script (/w2-client.js)
  └── Patches fetch / XHR / WebSocket / history / element URL properties
      inside every proxied page

Wisp Server (/wisp/)
  └── WebSocket-based TCP multiplexer (Wisp v1 protocol)

Presence (/w2-presence)
  └── WebSocket channel broadcasting the live count of connected clients
```

## URL encoding

Every proxied request's target URL is encoded into the path so it can travel
through the browser's address bar and history without being immediately
readable, and so it's a single opaque path segment safe to embed anywhere in
HTML.

1. UTF-8 encode the target URL string
2. XOR each byte with a fixed key (`0x57`)
3. Base64url-encode the result (no padding, `+` → `-`, `/` → `_`)

The result is appended to the proxy prefix: `/w2/<encoded>`. This is
obfuscation, not encryption. It keeps the URL out of casual view (e.g. a
teacher glancing at the address bar) but provides no real security guarantee
against anyone who inspects network traffic or reads the source.

`src/shared/url.ts` implements `encode`/`decode`/`toProxyUrl`/`fromProxyPath`
and is used identically on both the server (Node) and the client (browser):
both environments have native `TextEncoder`/`TextDecoder`/`btoa`/`atob`, so
the same code runs unmodified in both places.

## Request pipeline (`src/server/proxy.ts`)

For every request to `/w2/<encoded>`:

1. Decode the path back into a target URL.
2. Reject non-http(s) protocols.
3. Reject targets whose hostname matches a private/internal address pattern
   (loopback, RFC1918 ranges, link-local), an SSRF guard.
4. Reject targets whose host matches the proxy's own `Host` header, the
   self-loop guard, preventing WebSquared from being proxied through itself.
5. Build outbound request headers: everything the browser sent is forwarded
   *except* a blocklist (hop-by-hop headers, `Host`, `Cookie`/`Referer`/
   `Origin` which are handled specially, and Cloudflare/reverse-proxy
   metadata that would otherwise leak the visitor's real IP).
6. Forward the request body as a raw `Buffer` (via `express.raw({ type:
   '*/*' })`). This matters for any POST/PUT with a body: forms, JSON APIs,
   file uploads, analytics beacons, etc.
7. Fetch the target with `redirect: 'manual'` so redirects can be inspected,
   re-checked against the self-loop/SSRF guards, and rewritten before being
   followed (up to a fixed limit).
8. Rewrite response headers: strip ones that would leak upstream framing
   (`Content-Length`, `Content-Encoding`, `fetch()` already transparently
   decompresses the body) or security headers that would block our own
   injected script (CSP, X-Frame-Options, etc).
9. Rewrite `Set-Cookie` cookies with a per-origin namespace prefix (see
   below), and route the response body through the appropriate rewriter
   based on `Content-Type`:
   - `text/html` → `rewriteHtml()`
   - `text/css` → `rewriteCss()`
   - everything else → streamed straight through via `Readable.fromWeb()`,
     not buffered, so large files (video, big JS bundles) start reaching
     the browser immediately

## Cookie namespacing

Every site proxied through WebSquared shares one real domain in the
browser's eyes, so their cookies would otherwise collide in the browser's
single cookie jar (a `session` cookie from two different sites would
overwrite each other). Every `Set-Cookie` header is rewritten with a short
hash of the target's origin prepended to the cookie's name
(`w2c_<hash>_<name>`) before it reaches the browser; when a request is sent
back out to that same origin, the `Cookie` header is filtered to only the
cookies with that origin's tag, with the tag stripped back off. Both the
browser and the target site are unaware this is happening.

`Domain` and `SameSite` attributes are stripped from `Set-Cookie` (they no
longer mean what they meant on the real site, since the "site" as far as
the browser's cookie logic is concerned is now the proxy's own domain).
`Secure` is deliberately preserved. The proxy is always served over HTTPS
in production, and cookies using the `__Secure-`/`__Host-` prefix are
rejected outright by the browser if `Secure` is missing.

## HTML rewriting (`src/server/rewrite/html.ts`)

Uses [cheerio](https://cheerio.js.org/) to parse the response as HTML and:

- Removes CSP and X-Frame-Options meta tags (they'd block our own script)
- Removes `<base>` tags (they'd change how relative URLs resolve)
- Injects the target's real URL as `window.__W2_URL__` and inlines the
  built client script (`w2-client.js`) directly as a `<script>` tag, see
  "Why the client script is inlined" below
- Rewrites every URL-bearing attribute (`href`, `src`, `action`, etc.) on
  every relevant tag to a proxied `/w2/<encoded>` URL, upgrading `http://`
  to `https://` along the way
- Rewrites `target="_blank"/"_top"/"_parent"` to `_self` so navigation stays
  inside the iframe
- Rewrites inline `style` attributes and `<style>` blocks through the CSS
  rewriter (for `url(...)` references)

## CSS rewriting (`src/server/rewrite/css.ts`)

Rewrites `url(...)` and `@import` values the same way, resolved against the
page's base URL.

## Why the client script is inlined, not linked

`w2-client.js` and `w2-sw.js` are bundled separately by esbuild (see
`scripts/build-workers.mjs`) as standalone IIFEs with zero `import`/`export`
statements, not built by Vite alongside the main app. Vite's multi-entry
build used to split out a shared chunk that both files imported, which
works fine as an ES module but breaks the moment it's inlined into a
classic `<script>` tag (a bare `import` statement there is a hard syntax
error). Bundling as an IIFE means each file is fully self-contained.

The HTML rewriter inlines the built `w2-client.js` directly into every
proxied page's `<head>` rather than linking to it, so it's guaranteed to
execute before any of the target page's own scripts run. This is what
makes the `fetch`/`XMLHttpRequest`/`WebSocket` patches reliable.

## Injected client script (`src/worker/client.ts`)

Runs inside every proxied page (same-origin, since everything is served
from the proxy's own domain) and patches:

- `window.fetch` and `XMLHttpRequest.prototype.open`, resolve relative
  URLs against the *real* target URL (not the proxy's URL) before routing
  them through `/w2/<encoded>`
- `WebSocket`, same resolution
- `window.open`, `history.pushState`/`replaceState`, same resolution
- Property setters for `HTMLImageElement.src`, `HTMLScriptElement.src`,
  `HTMLLinkElement.href`, `HTMLIFrameElement.src`, plus `Element.
  setAttribute` for the same attributes, catches URLs assigned
  programmatically after the initial page load (e.g. a favicon `<link>`
  injected by the page's own JS), not just what was present in the
  server-rendered HTML
- A capturing `click` listener on `<a>` elements as a fallback

It also maintains a small rolling buffer of console output and network
requests (`window.__w2_devtools`), which the app's own DevTools panel reads
from the active tab's iframe when enabled in Settings.

## Service Worker (`src/worker/sw.ts`)

Registered by the app at `/w2-sw.js` (scope `/`). Intercepts `fetch` events
for requests whose `Referer` points at a proxied page but whose own URL
isn't already proxied, and reroutes them the same way the injected client
script does, catches JS-initiated requests that occur outside the
context the injected script can directly patch.

## Wisp server (`src/server/index.ts`)

Implements enough of the [Wisp v1 protocol](https://github.com/MercuryWorkshop/wisp-protocol)
(a WebSocket-based TCP multiplexer) to accept connections at `/wisp/`.
Present for future transport-layer work (e.g. a WASM TLS layer like
epoxy-tls), not currently wired up to anything in the browser.

## Presence (`src/server/presence.ts`)

A minimal WebSocket channel at `/w2-presence`. Every connected client is
tracked in an in-memory `Set`; the current count is broadcast to all
clients whenever someone connects or disconnects. No per-client identifying
information is tracked or stored.

## Client app (`src/client/`)

A Svelte 5 SPA. Key stores:

- `stores/tabs.ts`, the list of open tabs, persisted to `localStorage`
  (private tabs excluded). Setter methods (`setLoading`, `setNavState`,
  etc.) return the *same* array reference when a patch would be a no-op,
  so Svelte's store skips notifying subscribers. This matters because an
  effect that calls one of these setters unconditionally on every run could
  otherwise cascade into re-rendering, recreating downstream references,
  and re-triggering itself.
- `stores/history.ts`, `stores/bookmarks.ts`, `stores/settings.ts`, all
  `localStorage`-backed, never sent to the server.
- `stores/presence.ts`, the live connection count.

`components/ProxyFrame.svelte` owns the actual `<iframe>` and per-tab
navigation history (back/forward), and reports loading state and
navigation state back into the `tabs` store.

## Auto-deploy

`scripts/deploy-webhook.mjs` is a small standalone listener (started
alongside the main app via PM2) that verifies an HMAC-signed GitHub webhook
payload and, on a push to `main`, runs `git fetch && git reset --hard
origin/main && npm ci && npm run build && pm2 restart websquared`. If any
step fails, the chain stops before the restart, a broken build never
replaces a working deployment. See [DEPLOY.md](./DEPLOY.md) for setup.
