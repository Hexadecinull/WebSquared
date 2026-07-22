import { writable, get } from 'svelte/store';

export interface BookmarkFolder {
  id: string;
  name: string;
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  favicon: string;
  addedAt: number;
  folderId: string | null;
}

const BOOKMARKS_KEY = 'w2_bookmarks';
const FOLDERS_KEY = 'w2_bookmark_folders';

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function loadBookmarks(): Bookmark[] {
  try {
    const raw = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) ?? '[]') as Array<
      Partial<Bookmark> & { url: string }
    >;
    return raw.map((b) => ({
      id: b.id ?? makeId(),
      url: b.url,
      title: b.title ?? b.url,
      favicon: b.favicon ?? '',
      addedAt: b.addedAt ?? Date.now(),
      folderId: b.folderId ?? null,
    }));
  } catch {
    return [];
  }
}

function loadFolders(): BookmarkFolder[] {
  try {
    return JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveBookmarks(entries: Bookmark[]) {
  try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(entries)); } catch { /* ignore */ }
}

function saveFolders(folders: BookmarkFolder[]) {
  try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)); } catch { /* ignore */ }
}

const foldersStore = writable<BookmarkFolder[]>(loadFolders());
export const bookmarkFolders = { subscribe: foldersStore.subscribe };

function createBookmarkStore() {
  const { subscribe, update, set } = writable<Bookmark[]>(loadBookmarks());

  return {
    subscribe,
    folders: bookmarkFolders,

    add(url: string, title: string, favicon = '', folderId: string | null = null) {
      const existing = get({ subscribe }).find((b) => b.url === url);
      if (existing) return existing.id;
      const id = makeId();
      update((entries) => {
        const next = [{ id, url, title, favicon, addedAt: Date.now(), folderId }, ...entries];
        saveBookmarks(next);
        return next;
      });
      return id;
    },

    update(id: string, patch: Partial<Pick<Bookmark, 'title' | 'folderId'>>) {
      update((entries) => {
        const next = entries.map((b) => (b.id === id ? { ...b, ...patch } : b));
        saveBookmarks(next);
        return next;
      });
    },

    remove(url: string) {
      update((entries) => {
        const next = entries.filter((b) => b.url !== url);
        saveBookmarks(next);
        return next;
      });
    },

    removeById(id: string) {
      update((entries) => {
        const next = entries.filter((b) => b.id !== id);
        saveBookmarks(next);
        return next;
      });
    },

    isBookmarked(url: string): boolean {
      return get({ subscribe }).some((b) => b.url === url);
    },

    getByUrl(url: string): Bookmark | undefined {
      return get({ subscribe }).find((b) => b.url === url);
    },

    addFolder(name: string): string {
      const id = makeId();
      foldersStore.update((list) => {
        const next = [...list, { id, name }];
        saveFolders(next);
        return next;
      });
      return id;
    },

    renameFolder(id: string, name: string) {
      foldersStore.update((list) => {
        const next = list.map((f) => (f.id === id ? { ...f, name } : f));
        saveFolders(next);
        return next;
      });
    },

    removeFolder(id: string) {
      foldersStore.update((list) => {
        const next = list.filter((f) => f.id !== id);
        saveFolders(next);
        return next;
      });
      update((entries) => {
        const next = entries.map((b) => (b.folderId === id ? { ...b, folderId: null } : b));
        saveBookmarks(next);
        return next;
      });
    },

    clear() {
      saveBookmarks([]);
      saveFolders([]);
      set([]);
      foldersStore.set([]);
    },
  };
}

export const bookmarks = createBookmarkStore();
