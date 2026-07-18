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

/**
 * Replaces a single tab by id, but returns the SAME array reference untouched
 * if the patch would be a no-op. This is load-bearing: Svelte's writable store
 * only notifies subscribers when the new value differs by reference from the
 * old one, so returning an identical reference here silently short-circuits
 * the notification. Without this, any effect that unconditionally calls one
 * of these setters on every run (even when the value hasn't changed) can
 * cascade into components re-rendering, recreating inline prop closures,
 * and re-triggering the same effect — an infinite loop.
 */
function patchTab(tabs: Tab[], id: string, patch: Partial<Tab>): Tab[] {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx === -1) return tabs;
  const current = tabs[idx];
  let changed = false;
  for (const key in patch) {
    if (current[key as keyof Tab] !== patch[key as keyof Tab]) {
      changed = true;
      break;
    }
  }
  if (!changed) return tabs;
  const next = tabs.slice();
  next[idx] = { ...current, ...patch };
  return next;
}

function createTabStore() {
  const { subscribe, update, set } = writable<Tab[]>([makeTab()]);
  const activeId = writable<string>('');

  subscribe((tabs) => {
    activeId.update((id) => (tabs.find((t) => t.id === id) ? id : tabs[0]?.id ?? ''));
  });

  return {
    subscribe,
    activeId: { subscribe: activeId.subscribe },

    openTab(url = '', priv = false) {
      const proxySrc = url ? toProxyUrl(url) : '';
      const tab = makeTab(url, proxySrc, priv);
      update((tabs) => [...tabs, tab]);
      activeId.set(tab.id);
      return tab.id;
    },

    closeTab(id: string) {
      update((tabs) => {
        const idx = tabs.findIndex((t) => t.id === id);
        const next = tabs.filter((t) => t.id !== id);
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
      update((tabs) =>
        tabs.map((t) => {
          if (t.id !== id) return t;
          let hostname = url;
          try { hostname = new URL(url).hostname; } catch { /* keep raw */ }
          return { ...t, url, proxySrc, title: hostname, loading: true, favicon: '' };
        }),
      );
    },

    setTitle(id: string, title: string) {
      update((tabs) => patchTab(tabs, id, { title }));
    },

    setFavicon(id: string, favicon: string) {
      update((tabs) => patchTab(tabs, id, { favicon }));
    },

    setLoading(id: string, loading: boolean) {
      update((tabs) => patchTab(tabs, id, { loading }));
    },

    setNavState(id: string, canBack: boolean, canForward: boolean) {
      update((tabs) => patchTab(tabs, id, { canBack, canForward }));
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
