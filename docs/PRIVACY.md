# Privacy Policy

This describes how the WebSquared software behaves by default. WebSquared
is open source and self-hosted — if you're using an instance run by
someone else, they could in principle modify this behavior, so this
document describes the reference implementation in this repository, not
a guarantee about every instance everywhere.

## What's stored, and where

**Your browsing history, bookmarks, and settings are stored only in your
own browser** (`localStorage`), never sent to or stored on the server.
Clearing your browser's site data for your WebSquared instance's domain
deletes all of it. Private tabs don't write to history at all.

## What the server sees

Because WebSquared is a proxy, the server necessarily handles the URLs and
content of pages you visit while it's actively fetching them on your
behalf — that's inherent to how a proxy works. The reference server
implementation:

- Does **not** log which URLs you visit, request contents, or your IP
  address anywhere by default.
- Does **not** persist any per-visitor browsing data server-side. There
  is no database, no user accounts, no server-side history.
- Only tracks a live *count* of currently-connected clients (for the
  "people online" indicator) — no identifying information, just a number
  that goes up and down as WebSocket connections open and close.

## Cookies

Cookies set by sites you visit *through* WebSquared are stored in your own
browser, scoped so that different sites' cookies can't collide with each
other or be read across sites — see [ARCHITECTURE.md](./ARCHITECTURE.md)
for the technical detail. WebSquared itself doesn't set any tracking or
analytics cookies of its own.

## Third-party sites

Sites you access through WebSquared have their own privacy policies and
their own data practices, entirely outside WebSquared's control. Proxying
a site doesn't change what that site itself does with information you
give it directly (logging in, submitting a form, etc).

## No ads, no analytics, no third-party trackers

WebSquared's own interface doesn't include advertising, analytics scripts,
or third-party trackers of any kind.

## Changes to this policy

If this policy changes in a way that matters, it'll be reflected in this
file's Git history — check the repository's commit log for changes to
`docs/PRIVACY.md`.

## Questions

Open an issue on the repository if you have a question about how the
software handles data.
