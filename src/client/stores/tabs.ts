import { writable, derived } from 'svelte/store';
import { toProxyUrl } from '../../shared/url';

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

function loadPersistedTabs(): Tab[] {
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabList.filter((t) => !t.private)));
  } catch { /* ignore quota errors */ }
}

// Returns the same reference on a no-op patch so Svelte's store skips
// notifying subscribers, preventing needless re-renders.
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
  };
}

export const tabs = createTabStore();
export const activeTab = derived(
  [{ subscribe: tabs.subscribe }, tabs.activeId],
  ([$tabs, $activeId]) => $tabs.find((t) => t.id === $activeId) ?? $tabs[0],
);
