<script lang="ts">
  import { fly } from 'svelte/transition';

  let {
    getIframe,
  }: { getIframe: () => HTMLIFrameElement | undefined } = $props();

  interface ConsoleEntry { type: string; args: string[]; time: number }
  interface NetworkEntry { method: string; url: string; status: number | null; time: number; duration: number | null; initiator: string }

  let open = $state(false);
  let activeTab = $state<'console' | 'network'>('console');
  let consoleEntries = $state<ConsoleEntry[]>([]);
  let networkEntries = $state<NetworkEntry[]>([]);
  let pollHandle: ReturnType<typeof setInterval> | undefined;

  function poll() {
    const iframe = getIframe();
    const log = (iframe?.contentWindow as unknown as { __w2_devtools?: { console: ConsoleEntry[]; network: NetworkEntry[] } })
      ?.__w2_devtools;
    if (!log) return;
    consoleEntries = [...log.console].reverse();
    networkEntries = [...log.network].reverse();
  }

  function toggleOpen() {
    open = !open;
    if (open) {
      poll();
      pollHandle = setInterval(poll, 500);
    } else {
      clearInterval(pollHandle);
    }
  }

  function statusClass(status: number | null): string {
    if (status === null) return 'status-error';
    if (status >= 500) return 'status-error';
    if (status >= 400) return 'status-warn';
    return 'status-ok';
  }
</script>

<button class="devtools-fab" onclick={toggleOpen} aria-label="Toggle DevTools" title="WebSquared DevTools">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>
  </svg>
</button>

{#if open}
  <div class="devtools-panel" transition:fly={{ y: 24, duration: 180 }}>
    <div class="devtools-header">
      <div class="devtools-tabs">
        <button class:active={activeTab === 'console'} onclick={() => (activeTab = 'console')}>Console</button>
        <button class:active={activeTab === 'network'} onclick={() => (activeTab = 'network')}>Network</button>
      </div>
      <button class="devtools-close" onclick={toggleOpen} aria-label="Close DevTools">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="devtools-body">
      {#if activeTab === 'console'}
        {#if consoleEntries.length === 0}
          <p class="devtools-empty">No console output captured yet from the current tab.</p>
        {:else}
          {#each consoleEntries as entry, i (i)}
            <div class="console-line type-{entry.type}">
              <span class="line-type">{entry.type}</span>
              <span class="line-args">{entry.args.join(' ')}</span>
            </div>
          {/each}
        {/if}
      {:else}
        {#if networkEntries.length === 0}
          <p class="devtools-empty">No requests captured yet from the current tab.</p>
        {:else}
          {#each networkEntries as entry, i (i)}
            <div class="network-line">
              <span class="line-initiator">{entry.initiator}</span>
              <span class="line-method">{entry.method}</span>
              <span class="line-status {statusClass(entry.status)}">{entry.status ?? 'ERR'}</span>
              <span class="line-url">{entry.url}</span>
              <span class="line-duration">{entry.duration !== null ? `${entry.duration}ms` : ''}</span>
            </div>
          {/each}
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .devtools-fab {
    position: fixed; bottom: 1.25rem; right: 1.25rem; z-index: 300;
    width: 2.75rem; height: 2.75rem; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface-1); border: 1px solid var(--border);
    color: var(--text-2); cursor: pointer;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    transition: background 0.15s, color 0.15s, transform 0.15s;
  }
  .devtools-fab:hover { background: var(--surface-2); color: var(--accent); transform: scale(1.05); }
  .devtools-fab svg { width: 1.15rem; height: 1.15rem; }

  .devtools-panel {
    position: fixed; bottom: 4.75rem; right: 1.25rem; z-index: 300;
    width: min(480px, calc(100vw - 2rem)); height: min(340px, 50vh);
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 12px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
    display: flex; flex-direction: column; overflow: hidden;
  }

  .devtools-header {
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .devtools-tabs { display: flex; }
  .devtools-tabs button {
    padding: 0.6rem 1rem; background: transparent; border: none;
    color: var(--text-2); font-size: 0.8rem; cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  .devtools-tabs button.active { color: var(--text-1); border-bottom-color: var(--accent); }
  .devtools-close {
    display: flex; align-items: center; justify-content: center;
    width: 2rem; height: 2rem; margin-right: 0.5rem; border-radius: 6px;
    border: none; background: transparent; color: var(--text-2); cursor: pointer;
  }
  .devtools-close:hover { background: var(--surface-2); }
  .devtools-close svg { width: 0.9rem; height: 0.9rem; }

  .devtools-body {
    flex: 1; overflow-y: auto; padding: 0.5rem 0.75rem;
    font-family: 'SF Mono', Consolas, monospace; font-size: 0.72rem;
  }
  .devtools-empty { color: var(--text-3); padding: 1rem 0; text-align: center; }

  .console-line, .network-line {
    display: flex; gap: 0.5rem; padding: 0.3rem 0;
    border-bottom: 1px solid var(--surface-2); align-items: baseline;
  }
  .line-type {
    text-transform: uppercase; font-size: 0.6rem; font-weight: 700;
    flex-shrink: 0; width: 3.2rem; color: var(--text-3);
  }
  .type-error .line-type, .type-error .line-args { color: #f85149; }
  .type-warn .line-type, .type-warn .line-args { color: #d29922; }
  .line-args { word-break: break-word; color: var(--text-1); }

  .line-method { flex-shrink: 0; width: 3.2rem; color: var(--text-2); font-weight: 600; }
  .line-initiator {
    flex-shrink: 0; width: 3.6rem; text-transform: uppercase; font-size: 0.6rem;
    color: var(--text-3); font-weight: 700;
  }
  .line-status { flex-shrink: 0; width: 2.2rem; font-weight: 700; }
  .status-ok { color: #3fb950; }
  .status-warn { color: #d29922; }
  .status-error { color: #f85149; }
  .line-url { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-2); }
  .line-duration { flex-shrink: 0; color: var(--text-3); }

  @media (max-width: 640px) {
    .devtools-panel { width: calc(100vw - 1.5rem); right: 0.75rem; }
    .devtools-fab { bottom: 0.75rem; right: 0.75rem; }
  }
</style>
