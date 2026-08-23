import { writable, derived, get } from 'svelte/store';
import { toProxyUrl } from '../../shared/url';
import { settings } from './settings';

export interface Tab {
  id: string;
  title: string;
  url: string;
  proxySrc: string;
  favicon: string;
  loading: boolean;
  private: boolean;
  canBack: boolean;
  canForward: boolean;
}

const STORAGE_KEY = 'w2_tabs';

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

// Enforced here, not just in URLBar, so every navigation path is covered the same way on every platform.
function isSelfReferential(target: string): boolean {
  try {
    return new URL(target).hostname.toLowerCase() === window.location.hostname.toLowerCase();
  } catch {
    return false;
  }
}

function makeTab(url = '', proxySrc = '', priv = false): Tab {
  return {
    id: makeId(),
    title: url ? new URL(url).hostname : 'New Tab',
    url,
    proxySrc,
    favicon: '',
    loading: false,
    private: priv,
    canBack: false,
    canForward: false,
  };
}

// Off by default so WebSquared opens to a clean slate; opt in via Settings > Data & Privacy > Remember open tabs.
function loadPersistedTabs(): Tab[] {
  if (!get(settings).restoreTabsOnStartup) return [makeTab()];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [makeTab()];
    const parsed = JSON.parse(raw) as Tab[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [makeTab()];
    return parsed.map((t) => ({ ...t, loading: false, canBack: false, canForward: false }));
  } catch {
    return [makeTab()];
  }
}

function persistTabs(tabList: Tab[]) {
  if (!get(settings).restoreTabsOnStartup) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabList.filter((t) => !t.private)));
  } catch { /* ignore quota errors */ }
}

// Called when the user turns "Remember open tabs" off, so a stale snapshot can't reappear if it's turned back on later.
function forgetPersistedTabs() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// Returns the same reference on a no-op patch so Svelte's store skips notifying subscribers.
function patchTab(tabList: Tab[], id: string, patch: Partial<Tab>): Tab[] {
  const idx = tabList.findIndex((t) => t.id === id);
  if (idx === -1) return tabList;
  const current = tabList[idx];
  let changed = false;
  for (const key in patch) {
    if (current[key as keyof Tab] !== patch[key as keyof Tab]) {
      changed = true;
      break;
    }
  }
  if (!changed) return tabList;
  const next = tabList.slice();
  next[idx] = { ...current, ...patch };
  return next;
}

function createTabStore() {
  const { subscribe, update, set } = writable<Tab[]>(loadPersistedTabs());
  const activeId = writable<string>('');

  subscribe((tabList) => {
    activeId.update((id) => (tabList.find((t) => t.id === id) ? id : tabList[0]?.id ?? ''));
    persistTabs(tabList);
  });

  return {
    subscribe,
    activeId: { subscribe: activeId.subscribe },

    openTab(url = '', priv = false) {
      if (url && isSelfReferential(url)) url = '';
      const proxySrc = url ? toProxyUrl(url) : '';
      const tab = makeTab(url, proxySrc, priv);
      update((tabList) => [...tabList, tab]);
      activeId.set(tab.id);
      return tab.id;
    },

    closeTab(id: string) {
      update((tabList) => {
        const idx = tabList.findIndex((t) => t.id === id);
        const next = tabList.filter((t) => t.id !== id);
        if (next.length === 0) next.push(makeTab());
        activeId.update((current) => {
          if (current !== id) return current;
          return next[Math.min(idx, next.length - 1)].id;
        });
        return next;
      });
    },

    setActive(id: string) {
      activeId.set(id);
    },

    navigate(id: string, url: string) {
      if (isSelfReferential(url)) return;
      const proxySrc = toProxyUrl(url);
      update((tabList) =>
        tabList.map((t) => {
          if (t.id !== id) return t;
          let hostname = url;
          try { hostname = new URL(url).hostname; } catch { /* keep raw */ }
          return { ...t, url, proxySrc, title: hostname, loading: true, favicon: '' };
        }),
      );
    },

    setTitle(id: string, title: string) {
      update((tabList) => patchTab(tabList, id, { title }));
    },

    setFavicon(id: string, favicon: string) {
      update((tabList) => patchTab(tabList, id, { favicon }));
    },

    setLoading(id: string, loading: boolean) {
      update((tabList) => patchTab(tabList, id, { loading }));
    },

    setNavState(id: string, canBack: boolean, canForward: boolean) {
      update((tabList) => patchTab(tabList, id, { canBack, canForward }));
    },

    reset() {
      set([makeTab()]);
      activeId.set('');
    },

    forgetPersisted: forgetPersistedTabs,
  };
}

export const tabs = createTabStore();
export const activeTab = derived(
  [{ subscribe: tabs.subscribe }, tabs.activeId],
  ([$tabs, $activeId]) => $tabs.find((t) => t.id === $activeId) ?? $tabs[0],
);
