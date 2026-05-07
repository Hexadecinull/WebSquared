import { writable, get } from 'svelte/store';

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  favicon: string;
  addedAt: number;
}

const STORAGE_KEY = 'w2_bookmarks';

function load(): Bookmark[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function save(entries: Bookmark[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch { /* ignore */ }
}

function createBookmarkStore() {
  const { subscribe, update, set } = writable<Bookmark[]>(load());

  return {
    subscribe,

    add(url: string, title: string, favicon = '') {
      const existing = get({ subscribe }).find((b) => b.url === url);
      if (existing) return;
      update((entries) => {
        const next = [
          { id: Math.random().toString(36).slice(2, 9), url, title, favicon, addedAt: Date.now() },
          ...entries,
        ];
        save(next);
        return next;
      });
    },

    remove(url: string) {
      update((entries) => {
        const next = entries.filter((b) => b.url !== url);
        save(next);
        return next;
      });
    },

    isBookmarked(url: string): boolean {
      return get({ subscribe }).some((b) => b.url === url);
    },

    clear() {
      save([]);
      set([]);
    },
  };
}

export const bookmarks = createBookmarkStore();
