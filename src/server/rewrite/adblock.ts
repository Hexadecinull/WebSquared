// A curated list of well-known ad/tracker domains, enforced at the proxy level so a blocked request never reaches the upstream site at all.
const AD_HOST_SUFFIXES = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'google-analytics.com',
  'googletagmanager.com',
  'googletagservices.com',
  'adservice.google.com',
  'adnxs.com',
  'adsrvr.org',
  'advertising.com',
  'taboola.com',
  'outbrain.com',
  'criteo.com',
  'criteo.net',
  'moatads.com',
  'scorecardresearch.com',
  'quantserve.com',
  'pubmatic.com',
  'rubiconproject.com',
  'openx.net',
  'casalemedia.com',
  'amazon-adsystem.com',
  'adform.net',
  'bidswitch.net',
  'media.net',
  'yieldmo.com',
  'sharethrough.com',
  'zedo.com',
  'revcontent.com',
  'mgid.com',
  'adroll.com',
  'ads-twitter.com',
  'ads.linkedin.com',
  'ads.pinterest.com',
  'analytics.tiktok.com',
  'bat.bing.com',
  'hotjar.com',
  'segment.io',
  'segment.com',
  'mixpanel.com',
  'newrelic.com',
  'nr-data.net',
];

const AD_PATH_PATTERNS = [
  /^\/pagead\//i,
  /^\/adservice\//i,
  /(^|\/)ads?[_-]?(banner|frame|slot|unit)s?(\/|\.|$)/i,
];

function hostMatches(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return AD_HOST_SUFFIXES.some((suffix) => lower === suffix || lower.endsWith(`.${suffix}`));
}

export function isAdRequest(url: URL): boolean {
  if (hostMatches(url.hostname)) return true;
  return AD_PATH_PATTERNS.some((re) => re.test(url.pathname));
}

const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');

// Responds with something harmless shaped to the kind of resource it looks like, so the page doesn't show a broken image icon or a script error where an ad would have been.
export function respondBlocked(req: { headers: Record<string, unknown> }, res: {
  status: (n: number) => { type: (t: string) => { send: (body: unknown) => void }; end: () => void };
}, targetUrl: string): void {
  const accept = String(req.headers['accept'] ?? '');
  if (accept.includes('image/') || /\.(png|gif|jpe?g|webp|svg)(\?|$)/i.test(targetUrl)) {
    res.status(200).type('image/gif').send(TRANSPARENT_GIF);
    return;
  }
  if (accept.includes('javascript') || /\.js(\?|$)/i.test(targetUrl)) {
    res.status(200).type('application/javascript').send('/* blocked by WebSquared adblock */');
    return;
  }
  res.status(204).end();
}
