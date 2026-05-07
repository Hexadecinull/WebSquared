import { writable, get } from 'svelte/store';

export interface HistoryEntry {
  url: string;
  title: string;
  favicon: string;
  visitedAt: number;
}

const STORAGE_KEY = 'w2_history';
const MAX_ENTRIES = 500;

function load(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function save(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch { /* quota exceeded - silently ignore */ }
}

function createHistoryStore() {
  const { subscribe, update, set } = writable<HistoryEntry[]>(load());

  return {
    subscribe,

    push(url: string, title: string, favicon = '') {
      update((entries) => {
        const filtered = entries.filter((e) => e.url !== url);
        const next = [{ url, title, favicon, visitedAt: Date.now() }, ...filtered].slice(
          0,
          MAX_ENTRIES,
        );
        save(next);
        return next;
      });
    },

    suggest(query: string): HistoryEntry[] {
      if (!query) return [];
      const q = query.toLowerCase();
      return get({ subscribe })
        .filter((e) => e.url.toLowerCase().includes(q) || e.title.toLowerCase().includes(q))
        .slice(0, 6);
    },

    remove(url: string) {
      update((entries) => {
        const next = entries.filter((e) => e.url !== url);
        save(next);
        return next;
      });
    },

    clear() {
      save([]);
      set([]);
    },
  };
}

export const history = createHistoryStore();
