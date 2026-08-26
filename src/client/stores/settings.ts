import { writable } from 'svelte/store';

export interface Settings {
  theme: 'dark' | 'light' | 'system' | 'amoled';
  accent: string;
  deeperAccent: boolean;
  desktopMode: boolean;
  searchEngine: 'google' | 'bing' | 'duckduckgo' | 'brave' | 'ecosia' | 'qwant';
  newTabPage: 'default' | 'blank';
  fontSize: 'small' | 'medium' | 'large';
  pageZoom: number;
  smoothScrolling: boolean;
  blockAds: boolean;
  blockAdult: boolean;
  blockGambling: boolean;
  blockMalware: boolean;
  blockClickbait: boolean;
  saveHistory: boolean;
  openLinksInNewTab: boolean;
  sitePermissions: boolean;
  devToolsEnabled: boolean;
  verboseLogging: boolean;
  exposeDebugHelpers: boolean;
  restoreTabsOnStartup: boolean;
}

const STORAGE_KEY = 'w2_settings';

export const DEFAULT_ACCENT = '#4f8ef7';

const DEFAULTS: Settings = {
  theme: 'dark',
  accent: DEFAULT_ACCENT,
  deeperAccent: false,
  desktopMode: false,
  searchEngine: 'google',
  newTabPage: 'default',
  fontSize: 'medium',
  pageZoom: 100,
  smoothScrolling: true,
  blockAds: false,
  // On by default since this protects the server and visitor from known malicious/phishing domains, unlike the personal-preference filters below.
  blockAdult: false,
  blockGambling: false,
  blockMalware: true,
  blockClickbait: false,
  saveHistory: true,
  openLinksInNewTab: false,
  sitePermissions: false,
  devToolsEnabled: false,
  verboseLogging: false,
  exposeDebugHelpers: false,
  restoreTabsOnStartup: false,
};

export const SEARCH_URLS: Record<Settings['searchEngine'], string> = {
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  brave: 'https://search.brave.com/search?q=',
  ecosia: 'https://www.ecosia.org/search?q=',
  qwant: 'https://www.qwant.com/?q=',
};

export const FONT_SIZE_MAP: Record<Settings['fontSize'], string> = {
  small: '12px',
  medium: '14px',
  large: '16px',
};

export function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
    || window.innerWidth < 768;
}

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

function createSettingsStore() {
  const { subscribe, update } = writable<Settings>(load());

  return {
    subscribe,
    set<K extends keyof Settings>(key: K, value: Settings[K]) {
      update((s) => {
        const next = { ...s, [key]: value };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    },
    reset() {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      update(() => ({ ...DEFAULTS }));
    },
  };
}

export const settings = createSettingsStore();
