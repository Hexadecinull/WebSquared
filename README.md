# Web² (WebSquared)

An ad-free, open-source, lightweight web proxy. Browse freely from anywhere — no extensions, no installs, no ads.

[![CI](https://github.com/Hexadecinull/WebSquared/actions/workflows/ci.yml/badge.svg)](https://github.com/Hexadecinull/WebSquared/actions/workflows/ci.yml)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)

---

## Features

- **Ad-free** — no advertisements, no trackers, no data collection
- **Lightweight** — minimal dependencies, fast startup
- **Tabs** — open, close, and switch between multiple proxied sites, including private tabs
- **Back / forward / refresh** — a real per-tab navigation history, like a normal browser
- **Bookmarks & history** — saved locally in your browser; the URL bar autocompletes from your history as you type
- **Settings** — theme, font size, search engine, desktop mode (mobile), and more
- **Live "online now" counter** — see how many people are currently browsing through the same instance
- **Self-loop protection** — the proxy can't be pointed at itself, so it can't be recursively embedded in itself
- **Per-site cookie isolation** — cookies from different proxied sites are kept separate, so logging into one site can't collide with another
- **Service Worker** — intercepts dynamically-generated requests for deeper compatibility
- **Wisp server** — built-in Wisp v1 server for future transport upgrades
- **HTML/CSS rewriting** — all links and resource URLs are transparently rewritten
- **URL obfuscation** — target URLs are XOR-encoded and base64url-encoded so they are not plaintext in the address bar

## Architecture

```
Browser
  └── Svelte SPA (tabs, toolbar, settings, bookmarks, history)
        └── <iframe> → /w2/<encoded-url>
              └── Express server
                    ├── Server-side fetch → target site
                    ├── Per-origin cookie namespacing (isolates sites from each other)
                    ├── HTML rewriter (cheerio) → rewrites all URLs
                    ├── CSS rewriter → rewrites url() and @import
                    ├── Self-loop guard → blocks proxying the proxy's own domain
                    └── Static file server → dist/

Service Worker (/w2-sw.js)
  └── Intercepts JS-initiated external requests from proxied pages
        └── Reroutes them through /w2/<encoded-url>

Injected client script (/w2-client.js)
  └── Patches fetch / XHR / WebSocket / history / window.open inside every proxied page

Wisp Server (/wisp/)
  └── WebSocket-based TCP multiplexer (Wisp v1 protocol)
        └── Ready for transport-layer upgrades (epoxy, libcurl.js)

Presence (/w2-presence)
  └── WebSocket channel broadcasting the live count of connected clients
```

## Getting started (local development)

**Requirements:** Node.js ≥ 20

```bash
git clone https://github.com/Hexadecinull/WebSquared.git
cd WebSquared
npm install
```

### Development

```bash
npm run dev
```

Opens the Vite dev server at `http://localhost:5173`. The Express + Wisp server runs at `http://localhost:3000`. Vite proxies `/w2`, `/api`, `/wisp`, and `/w2-presence` to the backend automatically.

### Production

```bash
npm run build
npm start
```

Builds the client to `dist/`, bundles the worker scripts, and compiles the server to `dist-server/`, then serves everything from a single Express process on port `3000` (configurable via the `PORT` environment variable).

## Self-hosting

Want to run your own instance on a VPS or home server, with a real domain,
running continuously? See **[DEPLOY.md](./DEPLOY.md)** for a full walkthrough
covering PM2, Cloudflare Tunnel or nginx, and an optional GitHub auto-deploy
webhook so pushing to `main` deploys itself.

## URL encoding

Target URLs are encoded as follows:

1. UTF-8 encode the URL string
2. XOR each byte with `0x57`
3. Base64url-encode the result (no padding, `+`→`-`, `/`→`_`)

The result is appended to the proxy prefix: `/w2/<encoded>`.

## Known limitations

- WebSocket proxying through Wisp requires a WASM TLS transport (epoxy-tls / libcurl.js) — the Wisp server is present but the browser-side transport is not yet wired up
- Sites that rely on `window.location` equality checks or `document.domain` manipulation may behave incorrectly
- OAuth flows that use `postMessage` across origins will not work
- Service workers registered by the proxied site itself are not supported
- DRM-protected video (Widevine/EME) generally won't play through the proxy

## Contributing

Pull requests are welcome. Please open an issue first for larger changes. All contributions are made under the GPL-3.0 license.

## License

[GNU General Public License v3.0](LICENSE) © 2024 SSMG4 and contributors
