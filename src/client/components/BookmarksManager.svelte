<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { bookmarks, bookmarkFolders } from '../stores/bookmarks';

  let expandedFolders = $state<Record<string, boolean>>({});

  function toggleFolder(id: string) {
    expandedFolders[id] = !expandedFolders[id];
  }

  let topLevel = $derived($bookmarks.filter((b) => !b.folderId));
  function bookmarksInFolder(folderId: string) {
    return $bookmarks.filter((b) => b.folderId === folderId);
  }
</script>

<div class="manager">
  {#if $bookmarks.length === 0 && $bookmarkFolders.length === 0}
    <p class="empty">No bookmarks yet.</p>
  {:else}
    <ul class="entries">
      {#each topLevel as bm (bm.id)}
        <li transition:fade={{ duration: 120 }}>
          {#if bm.favicon}
            <img src={bm.favicon} alt="" width="14" height="14" />
          {:else}
            <span class="favicon-placeholder"></span>
          {/if}
          <div class="entry-text">
            <span class="entry-title">{bm.title}</span>
            <span class="entry-url">{bm.url}</span>
          </div>
          <button class="delete-btn" onclick={() => bookmarks.removeById(bm.id)} aria-label="Remove bookmark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </li>
      {/each}

      {#each $bookmarkFolders as folder (folder.id)}
        {@const items = bookmarksInFolder(folder.id)}
        <li class="folder-row">
          <button class="folder-toggle" onclick={() => toggleFolder(folder.id)}>
            <svg class="chevron" class:open={expandedFolders[folder.id]} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="folder-name">{folder.name}</span>
            <span class="folder-count">{items.length}</span>
          </button>
          <button class="delete-btn" onclick={() => bookmarks.removeFolder(folder.id)} aria-label="Delete folder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </li>
        {#if expandedFolders[folder.id]}
          <ul class="nested" transition:slide={{ duration: 150 }}>
            {#each items as bm (bm.id)}
              <li transition:fade={{ duration: 120 }}>
                {#if bm.favicon}
                  <img src={bm.favicon} alt="" width="14" height="14" />
                {:else}
                  <span class="favicon-placeholder"></span>
                {/if}
                <div class="entry-text">
                  <span class="entry-title">{bm.title}</span>
                  <span class="entry-url">{bm.url}</span>
                </div>
                <button class="delete-btn" onclick={() => bookmarks.removeById(bm.id)} aria-label="Remove bookmark">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </li>
            {:else}
              <li class="empty-folder">Empty folder</li>
            {/each}
          </ul>
        {/if}
      {/each}
    </ul>
  {/if}
</div>

<style>
  .manager { display: flex; flex-direction: column; gap: 0.6rem; }
  .empty { color: var(--text-3); font-size: 0.8rem; text-align: center; padding: 1.5rem 0; }
  .entries, .nested { display: flex; flex-direction: column; gap: 2px; max-height: 260px; overflow-y: auto; }
  .nested { max-height: none; padding-left: 1.5rem; margin-bottom: 2px; }
  li {
    display: flex; align-items: center; gap: 0.55rem;
    padding: 0.45rem 0.5rem; border-radius: 6px;
  }
  li:hover { background: var(--surface-2); }
  li img, .favicon-placeholder { width: 14px; height: 14px; flex-shrink: 0; }
  .entry-text { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .entry-title { font-size: 0.8rem; color: var(--text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .entry-url { font-size: 0.7rem; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .delete-btn {
    display: flex; align-items: center; justify-content: center;
    width: 1.5rem; height: 1.5rem; border-radius: 5px; flex-shrink: 0;
    border: none; background: transparent; color: var(--text-3); cursor: pointer;
  }
  .delete-btn:hover { background: var(--border); color: #f85149; }
  .delete-btn svg { width: 0.75rem; height: 0.75rem; }

  .folder-row { padding: 0; }
  .folder-toggle {
    flex: 1; display: flex; align-items: center; gap: 0.5rem;
    background: transparent; border: none; color: var(--text-1);
    padding: 0.45rem 0.5rem; cursor: pointer; font-size: 0.8rem; text-align: left;
  }
  .chevron { width: 0.7rem; height: 0.7rem; flex-shrink: 0; transition: transform 0.15s; color: var(--text-3); }
  .chevron.open { transform: rotate(90deg); }
  .folder-icon { width: 0.85rem; height: 0.85rem; flex-shrink: 0; color: var(--text-2); }
  .folder-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .folder-count { font-size: 0.7rem; color: var(--text-3); }
  .empty-folder { color: var(--text-3); font-size: 0.75rem; font-style: italic; }
</style>
