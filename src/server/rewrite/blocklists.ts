// Optional, user-controlled content filters that block whole categories of sites rather than unlock them (malware defaults on since it protects the server, not just personal preference); sources are hosts-file-format lists like uBlock/Pi-hole/AdGuard Home use, refreshed daily, and a stale/unreachable source just keeps its last-loaded copy instead of blocking everything.

export type FilterCategory = 'adult' | 'gambling' | 'malware' | 'clickbait';

const LIST_SOURCES: Record<FilterCategory, string[]> = {
  adult: ['https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/porn-only/hosts'],
  gambling: ['https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/gambling-only/hosts'],
  malware: [
    'https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-hosts.txt',
    'https://malware-filter.gitlab.io/malware-filter/phishing-filter-hosts.txt',
  ],
  // "Clickbait" isn't a domain property a hosts-file can capture directly (that would need judging each headline/thumbnail in real time), so this uses the closest real, maintained list instead: known fake-news and content-farm domains, the same sites clickbait overwhelmingly comes from in practice.
  clickbait: ['https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-only/hosts'],
};

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15000;

const lists: Record<FilterCategory, Set<string>> = {
  adult: new Set(),
  gambling: new Set(),
  malware: new Set(),
  clickbait: new Set(),
};

function parseHostsFile(text: string): string[] {
  const domains: string[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const parts = line.split(/\s+/);
    const domain = (parts.length >= 2 ? parts[1] : parts[0])?.toLowerCase();
    if (domain && domain !== 'localhost' && !domain.includes('/')) domains.push(domain);
  }
  return domains;
}

async function fetchList(url: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseHostsFile(await res.text());
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshCategory(category: FilterCategory): Promise<void> {
  const merged = new Set<string>();
  for (const url of LIST_SOURCES[category]) {
    try {
      for (const domain of await fetchList(url)) merged.add(domain);
    } catch (err) {
      console.warn(`[w2] Could not refresh the "${category}" filter list from ${url}, keeping the previous copy.`, err instanceof Error ? err.message : err);
      return;
    }
  }
  if (merged.size > 0) lists[category] = merged;
}

let started = false;

// Called once from the server entry point; safe to call more than once.
export function startBlocklistRefresh(): void {
  if (started) return;
  started = true;
  const categories = Object.keys(LIST_SOURCES) as FilterCategory[];
  for (const category of categories) refreshCategory(category).catch(() => { /* logged above */ });
  setInterval(() => {
    for (const category of categories) refreshCategory(category).catch(() => { /* logged above */ });
  }, REFRESH_INTERVAL_MS).unref();
}

// Hosts-file entries are exact domains, so parent suffixes are checked too, meaning a listed "example.com" also covers "sub.example.com".
export function isBlockedByCategory(hostname: string, category: FilterCategory): boolean {
  const set = lists[category];
  if (set.size === 0) return false;
  const parts = hostname.toLowerCase().split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    if (set.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}
