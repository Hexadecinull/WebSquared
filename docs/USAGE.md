# Using WebSquared

A quick guide to everything WebSquared can do.

## Browsing

Type a URL or a search term into the address bar and press **Enter** (or
tap the arrow button). If what you typed looks like a domain
(`example.com`), WebSquared opens it directly; otherwise it searches using
your chosen search engine (set in Settings → Browsing).

## Tabs

- **New tab**: the `+` button in the tab bar.
- **New private tab**: the incognito icon in the toolbar. Private tabs
  don't save browsing history, and they're not restored if you reload the
  page or restart your browser.
- **Close a tab**: the `×` on the tab, or the last remaining tab just
  becomes a fresh blank tab instead of closing the window.
- **Switch tabs**: click any tab. The page inside keeps running in the
  background — switching away doesn't reload it.

Your open tabs (except private ones) are remembered across page reloads,
so refreshing the WebSquared page itself won't lose your browsing session.

## Navigation

- **Back / Forward**: arrows in the toolbar, or use them like a normal
  browser — each tab has its own independent history.
- **Refresh**: the refresh icon reloads the current page inside that tab.
- **Bookmark**: the star icon saves the current page. Click it again to
  remove the bookmark, or right-click/long-press a bookmark to edit its
  name or move it to a folder.

## The address bar

Start typing and WebSquared suggests matching pages from your history.
Use the arrow keys to move through suggestions and Enter to pick one, or
just keep typing your own URL/search.

If you ever try to navigate WebSquared to itself, it'll refuse — no need
to worry about accidentally creating a page-inside-itself loop.

## Bookmarks

Click the star to bookmark the current page. A small popup lets you set
the bookmark's name and choose (or create) a folder to file it under —
your bookmarks bar shows top-level bookmarks and folders; anything filed
into a folder stays tucked away until you open that folder.

Manage all your bookmarks — rename, move, delete individually, or clear
everything — from Settings → Data & Privacy.

## History

WebSquared remembers pages you've visited (unless you're in a private tab,
or you've turned history off in Settings). View your full history, search
it, and delete individual entries or clear everything from Settings →
Data & Privacy.

## Settings

Open Settings from the gear icon in the toolbar.

- **Appearance** — theme (dark/light/system), font size, smooth scrolling.
- **Browsing** — default search engine, whether links open in new tabs,
  experimental ad blocking, and (on mobile) a desktop-mode toggle for
  sites that behave better with a desktop layout.
- **Data & Privacy** — manage history and bookmarks, or reset everything.
- **Developer** — turn on the DevTools panel (see below).
- **About** — the version you're running and a link to the source code.

You'll also see a small live counter showing how many people are
currently browsing through the same WebSquared instance as you.

## DevTools (optional, off by default)

Turning this on in Settings → Developer adds a small floating button in
the corner of the screen. Tapping it opens a lightweight console and
network log for whatever site you're currently viewing — mainly useful on
mobile, where there's no equivalent built into the browser. On desktop,
your browser's own DevTools (usually F12) already give you this and much
more.

## Things that won't work through a proxy

Some things are limitations of how any web proxy works, not bugs:

- Sites with CAPTCHA/anti-bot challenges tied to their own domain (like
  Google's reCAPTCHA) will generally fail — the challenge checks the
  domain it's running on, which will never match the real site when
  accessed through a proxy.
- DRM-protected video (the kind that needs Widevine/EME) generally won't
  play.
- Sites that open external OAuth/login popups expecting to communicate
  back to the exact original domain may not work correctly.
