# Web² (WebSquared)

An ad-free, open-source, lightweight web proxy. Browse freely from anywhere — no extensions, no installs, no ads.

[![CI](https://github.com/Hexadecinull/WebSquared/actions/workflows/ci.yml/badge.svg)](https://github.com/Hexadecinull/WebSquared/actions/workflows/ci.yml)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)

---

## Features

- **Ad-free** — no advertisements, no trackers, no data collection
- **Lightweight** — minimal dependencies, fast startup
- **Service Worker** — intercepts dynamically-generated requests for deeper compatibility
- **Wisp server** — built-in Wisp v1 server for future transport upgrades
- **HTML/CSS rewriting** — all links and resource URLs are transparently rewritten
- **API patching** — `fetch`, `XMLHttpRequest`, `WebSocket`, `history`, and `window.open` are patched inside proxied pages
- **URL obfuscation** — target URLs are XOR-encoded and base64url-encoded so they are not plaintext in the address bar

## Architecture

```
Browser
  └── Svelte SPA (toolbar + URL bar)
        └── <iframe> → /w2/<encoded-url>
              └── Express server
                    ├── Server-side fetch → target site
                    ├── HTML rewriter (cheerio) → rewrites all URLs
                    ├── CSS rewriter → rewrites url() and @import
                    └── Static file server → dist/

Service Worker (/w2-sw.js)
  └── Intercepts JS-initiated external requests from proxied pages
        └── Reroutes them through /w2/<encoded-url>

Injected client script (/w2-client.js)
  └── Patches fetch / XHR / WebSocket / history / window.open

Wisp Server (/wisp/)
  └── WebSocket-based TCP multiplexer (Wisp v1 protocol)
        └── Ready for transport-layer upgrades (epoxy, libcurl.js)
```

## Getting started

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

Opens the Vite dev server at `http://localhost:5173`. The Express + Wisp server runs at `http://localhost:3000`. Vite proxies `/w2`, `/api`, and `/wisp` to the backend automatically.

### Production

```bash
npm run build
npm start
```

Builds the client to `dist/` and the server to `dist-server/`, then serves everything from a single Express process on port `3000` (configurable via the `PORT` environment variable).

## URL encoding

Target URLs are encoded as follows:

1. UTF-8 encode the URL string
2. XOR each byte with `0x57`
3. Base64url-encode the result (no padding, `+`→`-`, `/`→`_`)

The result is appended to the proxy prefix: `/w2/<encoded>`.

## Known limitations (v0.1.0)

- WebSocket proxying through Wisp requires a WASM TLS transport (epoxy-tls / libcurl.js) — the Wisp server is present but the browser-side transport is not yet wired up
- Sites that rely on `window.location` equality checks or `document.domain` manipulation may behave incorrectly
- OAuth flows that use `postMessage` across origins will not work
- Service workers registered by the proxied site are not supported

## Contributing

Pull requests are welcome. Please open an issue first for larger changes. All contributions are made under the GPL-3.0 license.

## License

[GNU General Public License v3.0](LICENSE) © 2024 SSMG4 and contributors
