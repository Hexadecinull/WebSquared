<script lang="ts">
  import { scale } from 'svelte/transition';
  import { flip } from 'svelte/animate';
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
      transition:scale={{ duration: 160, start: 0.85 }}
      animate:flip={{ duration: 160 }}
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
          <path d="M17.5,11.75 C20.1233526,11.75 22.25,13.8766474 22.25,16.5 C22.25,19.1233526 20.1233526,21.25 17.5,21.25 C15.4019872,21.25 13.6216629,19.8898135 12.9927596,18.0031729 L11.0072404,18.0031729 C10.3783371,19.8898135 8.59801283,21.25 6.5,21.25 C3.87664744,21.25 1.75,19.1233526 1.75,16.5 C1.75,13.8766474 3.87664744,11.75 6.5,11.75 C8.9545808,11.75 10.9743111,13.6118164 11.224028,16.0002862 L12.775972,16.0002862 C13.0256889,13.6118164 15.0454192,11.75 17.5,11.75 Z M6.5,13.75 C4.98121694,13.75 3.75,14.9812169 3.75,16.5 C3.75,18.0187831 4.98121694,19.25 6.5,19.25 C8.01878306,19.25 9.25,18.0187831 9.25,16.5 C9.25,14.9812169 8.01878306,13.75 6.5,13.75 Z M17.5,13.75 C15.9812169,13.75 14.75,14.9812169 14.75,16.5 C14.75,18.0187831 15.9812169,19.25 17.5,19.25 C19.0187831,19.25 20.25,18.0187831 20.25,16.5 C20.25,14.9812169 19.0187831,13.75 17.5,13.75 Z M15.5119387,3 C16.7263613,3 17.7969992,3.79658742 18.145961,4.95979331 L19.1520701,8.31093387 C19.944619,8.44284508 20.7202794,8.59805108 21.4790393,8.77658283 C22.0166428,8.90307776 22.3499121,9.44143588 22.2234172,9.9790393 C22.0969222,10.5166428 21.5585641,10.8499121 21.0209607,10.7234172 C18.2654221,10.0750551 15.258662,9.75 12,9.75 C8.74133802,9.75 5.73457794,10.0750551 2.97903933,10.7234172 C2.44143588,10.8499121 1.90307776,10.5166428 1.77658283,9.9790393 C1.6500879,9.44143588 1.98335721,8.90307776 2.52096067,8.77658283 C3.27940206,8.59812603 4.05472975,8.4429754 4.8469317,8.31110002 L5.85403902,4.95979331 C6.20300079,3.79658742 7.2736387,3 8.4880613,3 L15.5119387,3 Z"/>
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
    opacity: 0; transition: opacity 0.15s, background 0.15s, transform 0.1s; outline: none;
  }
  .tab:hover .close, .tab.active .close { opacity: 1; }
  .close:hover { background: var(--border); color: var(--text-1); }
  .close:active { transform: scale(0.85); }
  .close svg { width: 10px; height: 10px; }
  .new-tab {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; flex-shrink: 0;
    background: transparent; border: none; border-radius: 6px;
    color: var(--text-2); cursor: pointer; transition: background 0.15s, color 0.15s, transform 0.15s;
  }
  .new-tab:hover { background: var(--surface-2); color: var(--text-1); }
  .new-tab:active { transform: scale(0.88); }
  .new-tab svg { width: 14px; height: 14px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
