<script lang="ts">
  import { tabs, activeTab } from '../stores/tabs';

  let { onNewTab, onCloseTab }: { onNewTab: () => void; onCloseTab: (id: string) => void } = $props();
</script>

<div class="tabbar">
  {#each $tabs as tab (tab.id)}
    <div
      class="tab"
      class:active={tab.id === $activeTab?.id}
      class:private={tab.private}
      onclick={() => tabs.setActive(tab.id)}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') tabs.setActive(tab.id); }}
      role="tab"
      tabindex="0"
      aria-selected={tab.id === $activeTab?.id}
      title={tab.url || 'New Tab'}
    >
      {#if tab.loading}
        <span class="tab-spinner"></span>
      {:else if tab.favicon}
        <img src={tab.favicon} alt="" width="12" height="12" class="tab-fav" />
      {:else}
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      {/if}
      <span class="tab-title">{tab.title}</span>
      {#if tab.private}
        <svg class="private-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M4 9c0-2.9 3.6-5.2 8-5.2s8 2.3 8 5.2v0.8H4V9z"/>
          <ellipse cx="12" cy="9.6" rx="10" ry="1.3"/>
          <path d="M2 11.2h20l-1.15 3.3a2.1 2.1 0 0 1-1.98 1.4h-1.85a2.1 2.1 0 0 1-1.98-1.45l-.5-1.55h-1.08l-.5 1.55a2.1 2.1 0 0 1-1.98 1.45H9.13a2.1 2.1 0 0 1-1.98-1.4L6 11.2z"/>
        </svg>
      {/if}
      <span
        class="close"
        onclick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
        onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onCloseTab(tab.id); } }}
        role="button"
        tabindex="0"
        aria-label="Close tab"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </span>
    </div>
  {/each}
  <button class="new-tab" onclick={onNewTab} aria-label="New tab" title="New tab">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  </button>
</div>

<style>
  .tabbar {
    display: flex; align-items: center;
    background: var(--bg); border-bottom: 1px solid var(--border);
    overflow-x: auto; flex-shrink: 0; gap: 2px; padding: 4px 4px 0;
    scrollbar-width: none;
  }
  .tabbar::-webkit-scrollbar { display: none; }
  .tab {
    display: flex; align-items: center; gap: 0.35rem;
    padding: 0.35rem 0.5rem; min-width: 120px; max-width: 200px;
    background: transparent; border: none; border-radius: 6px 6px 0 0;
    color: var(--text-2); cursor: pointer; font-size: 0.78rem;
    white-space: nowrap; flex-shrink: 0;
    transition: background 0.1s, color 0.1s; outline: none;
    position: relative; user-select: none;
  }
  .tab:hover { background: var(--surface-2); color: var(--text-1); }
  .tab.active { background: var(--surface-1); color: var(--text-1); }
  .tab.private { border-top: 2px solid #a78bfa; }
  .tab-title { flex: 1; overflow: hidden; text-overflow: ellipsis; }
  .tab-icon { width: 12px; height: 12px; flex-shrink: 0; }
  .tab-fav { flex-shrink: 0; }
  .private-icon { width: 11px; height: 11px; flex-shrink: 0; color: #a78bfa; }
  .tab-spinner {
    width: 12px; height: 12px; flex-shrink: 0;
    border: 2px solid var(--border); border-top-color: var(--accent);
    border-radius: 50%; animation: spin 0.7s linear infinite;
  }
  .close {
    display: flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0;
    color: var(--text-2); cursor: pointer;
    opacity: 0; transition: opacity 0.15s, background 0.15s; outline: none;
  }
  .tab:hover .close, .tab.active .close { opacity: 1; }
  .close:hover { background: var(--border); color: var(--text-1); }
  .close svg { width: 10px; height: 10px; }
  .new-tab {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; flex-shrink: 0;
    background: transparent; border: none; border-radius: 6px;
    color: var(--text-2); cursor: pointer; transition: background 0.15s, color 0.15s;
  }
  .new-tab:hover { background: var(--surface-2); color: var(--text-1); }
  .new-tab svg { width: 14px; height: 14px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
