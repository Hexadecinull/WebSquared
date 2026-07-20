import { writable } from 'svelte/store';

export interface Settings {
  theme: 'dark' | 'light' | 'system';
  desktopMode: boolean;
  searchEngine: 'google' | 'bing' | 'duckduckgo' | 'brave' | 'ecosia';
  newTabPage: 'default' | 'blank';
  fontSize: 'small' | 'medium' | 'large';
  smoothScrolling: boolean;
  blockAds: boolean;
  saveHistory: boolean;
  openLinksInNewTab: boolean;
  devToolsEnabled: boolean;
}

const STORAGE_KEY = 'w2_settings';

const DEFAULTS: Settings = {
  theme: 'dark',
  desktopMode: false,
  searchEngine: 'google',
  newTabPage: 'default',
  fontSize: 'medium',
  smoothScrolling: true,
  blockAds: false,
  saveHistory: true,
  openLinksInNewTab: false,
  devToolsEnabled: false,
};

export const SEARCH_URLS: Record<Settings['searchEngine'], string> = {
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  brave: 'https://search.brave.com/search?q=',
  ecosia: 'https://www.ecosia.org/search?q=',
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
