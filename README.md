# Web² (WebSquared)

An ad-free, open-source, lightweight web proxy. Browse freely from anywhere, no extensions, no installs, no ads.

[![CI](https://github.com/Hexadecinull/WebSquared/actions/workflows/ci.yml/badge.svg)](https://github.com/Hexadecinull/WebSquared/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Hexadecinull/WebSquared/actions/workflows/codeql.yml/badge.svg)](https://github.com/Hexadecinull/WebSquared/actions/workflows/codeql.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

---

## Features

- **Ad-free**: no advertisements, no trackers, no data collection
- **Lightweight**: minimal dependencies, fast startup
- **Tabs**: open, close, and switch between multiple proxied sites, including private tabs
- **Back / forward / refresh**: a real per-tab navigation history, like a normal browser
- **Bookmarks & history**: saved locally in your browser, with folders and individual-entry management
- **Settings**: theme, font size, search engine, desktop mode (mobile), and more
- **Live "online now" counter**: see how many people are currently browsing through the same instance
- **Self-loop & SSRF protection**: the proxy can't be pointed at itself or at internal/private addresses
- **Per-site cookie isolation**: cookies from different proxied sites are kept separate, so logging into one site can't collide with another
- **Service Worker**: intercepts dynamically-generated requests for deeper compatibility
- **URL obfuscation**: target URLs are XOR-encoded and base64url-encoded so they are not plaintext in the address bar

For how everything actually works under the hood, see [ARCHITECTURE.md](docs/ARCHITECTURE.md).
For a guide to using every feature, see [USAGE.md](docs/USAGE.md).

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
running continuously? See **[docs/DEPLOY.md](docs/DEPLOY.md)** for a full
walkthrough covering PM2, Cloudflare Tunnel or nginx, and an optional
GitHub auto-deploy webhook so pushing to `main` deploys itself.

## Known limitations

- WebSocket proxying through Wisp requires a WASM TLS transport (epoxy-tls / libcurl.js), the Wisp server is present but the browser-side transport is not yet wired up
- Sites that rely on `window.location` equality checks or `document.domain` manipulation may behave incorrectly
- OAuth flows that use `postMessage` across origins will not work
- Service workers registered by the proxied site itself are not supported
- DRM-protected video (Widevine/EME) generally won't play through the proxy
- CAPTCHA/anti-bot challenges tied to their own domain (e.g. Google's reCAPTCHA) will generally fail. This is inherent to how any proxy works, not fixable on our end

## Documentation

See [docs/README.md](docs/README.md) for the full documentation index: usage, self-hosting, architecture, contributing, and policies.

## Contributing

Pull requests are welcome, see [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines. All contributions are made under the AGPL-3.0 license.

## License

[GNU Affero General Public License v3.0](LICENSE) © 2026 SSMG4 and contributors
