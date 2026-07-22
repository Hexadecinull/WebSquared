# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a security vulnerability.

Instead, use GitHub's private vulnerability reporting: on the repository,
go to **Security → Advisories → Report a vulnerability**. This opens a
private conversation with the maintainers that isn't visible publicly
until a fix is ready.

Please include:
- What the vulnerability is and why it matters
- Steps to reproduce it
- Which version/commit you tested against

We'll acknowledge reports as promptly as we can and keep you updated as a
fix is worked on.

## What's in scope

The WebSquared codebase itself: the proxy server, the HTML/CSS rewriting
pipeline, the injected client script, the service worker, cookie handling,
and the deploy tooling in this repository.

## What's out of scope

- The content of third-party sites accessed *through* a WebSquared
  instance — that's between you and the site you're visiting.
- The fact that WebSquared lets traffic reach sites that a network
  administrator has blocked. That's the stated purpose of the project,
  not a vulnerability. If you're a network operator with concerns about
  WebSquared being used on your network, that's a policy/network question
  for your own infrastructure, not something we can fix in this codebase.
- Security of a specific self-hosted instance's server, OS, or hosting
  environment — those are the responsibility of whoever operates that
  instance.

## Current defenses

- **Self-loop guard** — the proxy refuses to proxy its own domain (as an
  initial request or via a redirect), preventing recursive embedding.
- **SSRF guard** — requests to loopback, RFC1918 private ranges, and
  link-local addresses are rejected, both as an initial target and on
  redirect. This is hostname-pattern matching, not DNS-resolution-based,
  so it stops naive attempts but not a determined DNS-rebinding attack.
- **Per-origin cookie namespacing** — cookies from different proxied
  sites can't collide or be read by a different origin than the one that
  set them, even though they all share the proxy's one real domain.
- **No server-side logging of browsing activity** — the server doesn't
  log which URLs are being proxied, request contents, or client IPs
  anywhere by default.
- **Security headers stripped from upstream, not weakened on our end** —
  we remove the *target* site's CSP/X-Frame-Options (necessary for the
  page to render inside our iframe at all), we don't add anything that
  weakens the proxy's own security posture.

## Known gaps

Being upfront about what isn't handled yet, rather than implying more
coverage than actually exists:

- **No rate limiting** on the proxy endpoint. A single client (or a
  small number of them) could currently send a high volume of requests.
  Anyone deploying a public-facing instance and concerned about abuse
  should consider adding rate limiting at the reverse-proxy/CDN layer
  (e.g. a Cloudflare rule) in front of WebSquared until this is addressed
  in the application itself.
- **SSRF protection is pattern-based**, not resolution-based (see above).
- **No CAPTCHA/abuse detection of our own** — WebSquared doesn't attempt
  to detect or throttle automated/bot traffic hitting it.

## Supported versions

Only the latest version on the `main` branch is supported. Since
WebSquared is typically self-hosted and deployed directly from `main`,
there isn't a maintained set of older release branches to backport fixes
to — updating to the latest commit is the way to get a fix.
