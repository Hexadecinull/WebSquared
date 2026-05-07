<script lang="ts">
  let {
    canBack,
    canForward,
    loading,
    bookmarked,
    onBack,
    onForward,
    onRefresh,
    onBookmark,
  }: {
    canBack: boolean;
    canForward: boolean;
    loading: boolean;
    bookmarked: boolean;
    onBack: () => void;
    onForward: () => void;
    onRefresh: () => void;
    onBookmark: () => void;
  } = $props();
</script>

<div class="nav-btns">
  <button onclick={onBack} disabled={!canBack} aria-label="Back" title="Back">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  </button>
  <button onclick={onForward} disabled={!canForward} aria-label="Forward" title="Forward">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  </button>
  <button onclick={onRefresh} aria-label={loading ? 'Stop' : 'Refresh'} title={loading ? 'Stop' : 'Refresh'} class:spinning={loading}>
    {#if loading}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>
    {/if}
  </button>
  <button onclick={onBookmark} aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'} title={bookmarked ? 'Remove bookmark' : 'Bookmark'} class:bookmarked>
    <svg viewBox="0 0 24 24" fill={bookmarked ? 'var(--accent)' : 'none'} stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  </button>
</div>

<style>
  .nav-btns { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
  button {
    display: flex; align-items: center; justify-content: center;
    width: 2rem; height: 2rem; border-radius: 6px;
    border: none; background: transparent; color: var(--text-2);
    cursor: pointer; transition: background 0.15s, color 0.15s;
  }
  button:hover:not(:disabled) { background: var(--surface-2); color: var(--text-1); }
  button:disabled { opacity: 0.3; cursor: default; }
  button.bookmarked { color: var(--accent); }
  button svg { width: 1rem; height: 1rem; }
</style>
