<script lang="ts">
  import { fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { history } from '../stores/history';

  let query = $state('');

  let filtered = $derived(
    query.trim()
      ? $history.filter(
          (e) =>
            e.url.toLowerCase().includes(query.toLowerCase()) ||
            e.title.toLowerCase().includes(query.toLowerCase()),
        )
      : $history,
  );

  function formatTime(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  }
</script>

<div class="manager">
  <input
    type="text"
    class="search"
    placeholder="Search history…"
    bind:value={query}
  />

  {#if filtered.length === 0}
    <p class="empty">{query ? 'No matching history entries.' : 'No history yet.'}</p>
  {:else}
    <ul class="entries">
      {#each filtered as entry (entry.url)}
        <li transition:fade={{ duration: 120 }} animate:flip={{ duration: 150 }}>
          {#if entry.favicon}
            <img src={entry.favicon} alt="" width="14" height="14" />
          {:else}
            <span class="favicon-placeholder"></span>
          {/if}
          <div class="entry-text">
            <span class="entry-title">{entry.title || entry.url}</span>
            <span class="entry-url">{entry.url}</span>
          </div>
          <span class="entry-time">{formatTime(entry.visitedAt)}</span>
          <button class="delete-btn" onclick={() => history.remove(entry.url)} aria-label="Remove from history">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .manager { display: flex; flex-direction: column; gap: 0.6rem; }
  .search {
    background: var(--surface-2); border: 1px solid var(--border);
    color: var(--text-1); border-radius: 8px; padding: 0.5rem 0.7rem;
    font-size: 0.8rem; font-family: inherit;
  }
  .empty { color: var(--text-3); font-size: 0.8rem; text-align: center; padding: 1.5rem 0; }
  .entries { display: flex; flex-direction: column; gap: 2px; max-height: 260px; overflow-y: auto; }
  li {
    display: flex; align-items: center; gap: 0.55rem;
    padding: 0.45rem 0.5rem; border-radius: 6px;
  }
  li:hover { background: var(--surface-2); }
  li img, .favicon-placeholder { width: 14px; height: 14px; flex-shrink: 0; }
  .entry-text { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .entry-title { font-size: 0.8rem; color: var(--text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .entry-url { font-size: 0.7rem; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .entry-time { font-size: 0.7rem; color: var(--text-3); flex-shrink: 0; }
  .delete-btn {
    display: flex; align-items: center; justify-content: center;
    width: 1.5rem; height: 1.5rem; border-radius: 5px; flex-shrink: 0;
    border: none; background: transparent; color: var(--text-3); cursor: pointer;
  }
  .delete-btn:hover { background: var(--border); color: #f85149; }
  .delete-btn svg { width: 0.75rem; height: 0.75rem; }
</style>
