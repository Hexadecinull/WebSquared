<script lang="ts">
  import { untrack } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { bookmarks, bookmarkFolders } from '../stores/bookmarks';
  import type { Bookmark } from '../stores/bookmarks';

  let {
    bookmark,
    onClose,
  }: { bookmark: Bookmark; onClose: () => void } = $props();

  let name = $state(untrack(() => bookmark.title));
  let folderId = $state(untrack(() => bookmark.folderId));
  let creatingFolder = $state(false);
  let newFolderName = $state('');

  function save() {
    bookmarks.update(bookmark.id, { title: name.trim() || bookmark.url, folderId });
  }

  function handleFolderChange(e: Event) {
    const value = (e.currentTarget as HTMLSelectElement).value;
    if (value === '__new__') {
      creatingFolder = true;
      return;
    }
    folderId = value === '__none__' ? null : value;
    save();
  }

  function confirmNewFolder() {
    const trimmed = newFolderName.trim();
    if (!trimmed) { creatingFolder = false; return; }
    const id = bookmarks.addFolder(trimmed);
    folderId = id;
    creatingFolder = false;
    newFolderName = '';
    save();
  }

  function removeBookmark() {
    bookmarks.removeById(bookmark.id);
    onClose();
  }

  function handleNameBlur() {
    save();
  }
</script>

<div class="scrim" onclick={onClose} role="presentation" transition:fade={{ duration: 120 }}></div>
<div class="popup" role="dialog" aria-label="Edit bookmark" transition:fly={{ y: -8, duration: 150 }}>
  <div class="popup-header">
    <svg viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" stroke-width="1" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
    <span>Bookmark added</span>
  </div>

  <label class="field">
    <span>Name</span>
    <input type="text" bind:value={name} onblur={handleNameBlur} />
  </label>

  <label class="field">
    <span>Folder</span>
    {#if creatingFolder}
      <div class="new-folder-row">
        <input
          type="text"
          placeholder="Folder name"
          bind:value={newFolderName}
          onkeydown={(e) => { if (e.key === 'Enter') confirmNewFolder(); }}
        />
        <button class="mini-btn" onclick={confirmNewFolder}>Add</button>
      </div>
    {:else}
      <select value={folderId ?? '__none__'} onchange={handleFolderChange}>
        <option value="__none__">Bookmarks bar</option>
        {#each $bookmarkFolders as folder (folder.id)}
          <option value={folder.id}>{folder.name}</option>
        {/each}
        <option value="__new__">+ New folder…</option>
      </select>
    {/if}
  </label>

  <div class="popup-actions">
    <button class="remove-btn" onclick={removeBookmark}>Remove Bookmark</button>
    <button class="done-btn" onclick={onClose}>Done</button>
  </div>
</div>

<style>
  .scrim { position: fixed; inset: 0; z-index: 210; }
  .popup {
    position: fixed; top: 3.25rem; right: 1rem; z-index: 211;
    width: min(280px, calc(100vw - 2rem));
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 10px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
    padding: 0.9rem; display: flex; flex-direction: column; gap: 0.7rem;
  }
  .popup-header {
    display: flex; align-items: center; gap: 0.4rem;
    font-size: 0.85rem; font-weight: 600; color: var(--text-1);
    padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);
  }
  .popup-header svg { width: 1rem; height: 1rem; flex-shrink: 0; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.75rem; color: var(--text-2); }
  input, select {
    background: var(--surface-2); border: 1px solid var(--border);
    color: var(--text-1); border-radius: 6px; padding: 0.4rem 0.55rem;
    font-size: 0.8rem; font-family: inherit;
  }
  select { cursor: pointer; }
  .new-folder-row { display: flex; gap: 0.4rem; }
  .new-folder-row input { flex: 1; }
  .mini-btn {
    padding: 0.4rem 0.6rem; border-radius: 6px; border: none;
    background: var(--accent); color: #fff; font-size: 0.75rem; cursor: pointer;
  }
  .popup-actions { display: flex; justify-content: space-between; gap: 0.5rem; padding-top: 0.3rem; }
  .remove-btn {
    background: transparent; border: none; color: #f85149;
    font-size: 0.78rem; cursor: pointer; padding: 0.3rem 0;
  }
  .remove-btn:hover { text-decoration: underline; }
  .done-btn {
    background: var(--accent); border: none; color: #fff;
    border-radius: 6px; padding: 0.4rem 0.9rem; font-size: 0.8rem; cursor: pointer;
  }
</style>
