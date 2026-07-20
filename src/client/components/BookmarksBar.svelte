<script lang="ts">
  import { slide, scale } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { bookmarks } from '../stores/bookmarks';

  let { onNavigate }: { onNavigate: (url: string) => void } = $props();
</script>

{#if $bookmarks.length > 0}
  <div class="bbar" transition:slide={{ duration: 160 }}>
    {#each $bookmarks as b (b.id)}
      <button onclick={() => onNavigate(b.url)} title={b.url} transition:scale={{ duration: 140, start: 0.85 }} animate:flip={{ duration: 140 }}>
        {#if b.favicon}
          <img src={b.favicon} alt="" width="12" height="12" />
        {/if}
        <span>{b.title || b.url}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .bbar {
    display: flex; align-items: center; gap: 2px;
    padding: 2px 8px; background: var(--surface-1);
    border-bottom: 1px solid var(--border); overflow-x: auto;
    flex-shrink: 0; scrollbar-width: none;
  }
  .bbar::-webkit-scrollbar { display: none; }
  button {
    display: flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: 4px;
    border: none; background: transparent; color: var(--text-2);
    font-size: 0.75rem; font-family: inherit; cursor: pointer;
    white-space: nowrap; max-width: 160px;
    transition: background 0.1s, color 0.1s;
  }
  button:hover { background: var(--surface-2); color: var(--text-1); }
  span { overflow: hidden; text-overflow: ellipsis; }
</style>
