<script lang="ts">
  import { onMount } from 'svelte';
  import { tabs, activeTab } from './stores/tabs';
  import { bookmarks } from './stores/bookmarks';
  import { settings, FONT_SIZE_MAP } from './stores/settings';
  import URLBar from './components/URLBar.svelte';
  import NavButtons from './components/NavButtons.svelte';
  import TabBar from './components/TabBar.svelte';
  import ProxyFrame from './components/ProxyFrame.svelte';
  import BookmarksBar from './components/BookmarksBar.svelte';
  import SettingsPanel from './components/SettingsPanel.svelte';

  let showSettings = $state(false);
  let swReady = $state(false);

  let frameRefs = $state<Record<string, ProxyFrame>>({});
  let frameLoading = $derived($activeTab?.loading ?? false);
  let navState = $state<Record<string, { back: boolean; fwd: boolean }>>({});
  let canBack = $derived($activeTab ? (navState[$activeTab.id]?.back ?? false) : false);
  let canForward = $derived($activeTab ? (navState[$activeTab.id]?.fwd ?? false) : false);

  function getActiveFrame(): ProxyFrame | undefined {
    return $activeTab ? frameRefs[$activeTab.id] : undefined;
  }

  function applyTheme(s: typeof $settings) {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = s.theme === 'dark' || (s.theme === 'system' && prefersDark);
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    root.style.fontSize = FONT_SIZE_MAP[s.fontSize];
    root.style.scrollBehavior = s.smoothScrolling ? 'smooth' : 'auto';
  }

  $effect(() => { applyTheme($settings); });

  async function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register('/w2-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      swReady = true;
    } catch { /* non-fatal */ }
  }

  onMount(() => { registerSW(); });

  function navigate(url: string, tabId?: string) {
    const id = tabId ?? $activeTab?.id;
    if (!id) return;
    tabs.navigate(id, url);
  }

  function openNewTab(url = '', priv = false) {
    tabs.openTab(url, priv);
  }

  function closeTab(id: string) {
    tabs.closeTab(id);
    delete frameRefs[id];
  }

  function goBack() { getActiveFrame()?.goBack(); }
  function goForward() { getActiveFrame()?.goForward(); }
  function refresh() { getActiveFrame()?.refresh(); }

  function toggleBookmark() {
    const tab = $activeTab;
    if (!tab?.url) return;
    if (bookmarks.isBookmarked(tab.url)) {
      bookmarks.remove(tab.url);
    } else {
      bookmarks.add(tab.url, tab.title, tab.favicon);
    }
  }

  let isBookmarked = $derived($activeTab ? bookmarks.isBookmarked($activeTab.url) : false);
</script>

<div class="shell">
  <TabBar onNewTab={() => openNewTab()} onCloseTab={closeTab} />

  <header class="toolbar">
    <a class="brand" href="/" aria-label="WebSquared home">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="2" width="9" height="9" rx="1.5" fill="var(--accent)"/>
        <rect x="13" y="2" width="9" height="9" rx="1.5" fill="var(--accent)" opacity="0.6"/>
        <rect x="2" y="13" width="9" height="9" rx="1.5" fill="var(--accent)" opacity="0.6"/>
        <rect x="13" y="13" width="9" height="9" rx="1.5" fill="var(--accent)"/>
      </svg>
    </a>

    <NavButtons
      canBack={canBack}
      canForward={canForward}
      loading={frameLoading}
      bookmarked={isBookmarked}
      onBack={goBack}
      onForward={goForward}
      onRefresh={refresh}
      onBookmark={toggleBookmark}
    />

    <URLBar
      url={$activeTab?.url ?? ''}
      onNavigate={(url) => navigate(url)}
    />

    <div class="toolbar-end">
      <button
        class="icon-btn"
        onclick={() => openNewTab('', true)}
        title="New private tab"
        aria-label="New private tab"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </button>
      <button
        class="icon-btn"
        onclick={() => { showSettings = !showSettings; }}
        title="Settings"
        aria-label="Settings"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
      <div class="sw-dot" class:ready={swReady} title={swReady ? 'Service worker active' : 'Initialising…'}></div>
    </div>
  </header>

  <BookmarksBar onNavigate={(url) => navigate(url)} />

  <main class="viewport">
    {#each $tabs as tab (tab.id)}
      <div class="tab-pane" class:visible={tab.id === $activeTab?.id}>
        {#if tab.proxySrc}
          <ProxyFrame
            bind:this={frameRefs[tab.id]}
            tabId={tab.id}
            src={tab.proxySrc}
            desktopMode={$settings.desktopMode}
            onNavState={(back, fwd) => { navState[tab.id] = { back, fwd }; }}
          />
        {:else}
          <div class="splash">
            <svg width="56" height="56" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="2" y="2" width="9" height="9" rx="1.5" fill="var(--accent)"/>
              <rect x="13" y="2" width="9" height="9" rx="1.5" fill="var(--accent)" opacity="0.6"/>
              <rect x="2" y="13" width="9" height="9" rx="1.5" fill="var(--accent)" opacity="0.6"/>
              <rect x="13" y="13" width="9" height="9" rx="1.5" fill="var(--accent)"/>
            </svg>
            <h1>Web²</h1>
            <p>Enter a URL or search above.</p>
            {#if tab.private}
              <p class="private-note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                </svg>
                Private tab — history won't be saved.
              </p>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </main>
</div>

{#if showSettings}
  <SettingsPanel onClose={() => { showSettings = false; }} />
{/if}

<style>
  :global(*), :global(*::before), :global(*::after) { box-sizing: border-box; margin: 0; padding: 0; }

  :global(:root), :global([data-theme="dark"]) {
    --bg: #0f1117; --surface-1: #161b22; --surface-2: #1c2230;
    --border: #30363d; --text-1: #e6edf3; --text-2: #8b949e; --text-3: #484f58;
    --accent: #4f8ef7; --accent-hover: #3d7ae5; --radius: 0.5rem;
  }

  :global([data-theme="light"]) {
    --bg: #f6f8fa; --surface-1: #ffffff; --surface-2: #f0f2f5;
    --border: #d0d7de; --text-1: #1f2328; --text-2: #57606a; --text-3: #9198a1;
    --accent: #0969da; --accent-hover: #0860c9; --radius: 0.5rem;
  }

  :global(html), :global(body) {
    height: 100%; background: var(--bg); color: var(--text-1);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased;
  }

  :global(a) { color: var(--accent); text-decoration: none; }
  :global(a:hover) { text-decoration: underline; }
  :global(#app) { height: 100%; display: flex; flex-direction: column; }

  .shell { display: flex; flex-direction: column; height: 100%; }

  .toolbar {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.375rem 0.75rem; background: var(--surface-1);
    border-bottom: 1px solid var(--border); flex-shrink: 0; height: 3rem;
  }

  .brand {
    display: flex; align-items: center; text-decoration: none; flex-shrink: 0;
  }

  .toolbar-end { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }

  .icon-btn {
    display: flex; align-items: center; justify-content: center;
    width: 2rem; height: 2rem; border-radius: 6px;
    border: none; background: transparent; color: var(--text-2); cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .icon-btn:hover { background: var(--surface-2); color: var(--text-1); }
  .icon-btn svg { width: 1rem; height: 1rem; }

  .sw-dot {
    width: 0.5rem; height: 0.5rem; border-radius: 50%;
    background: var(--text-3); transition: background 0.3s; margin-left: 4px;
  }
  .sw-dot.ready { background: #3fb950; }

  .viewport { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }

  .tab-pane {
    display: none; flex: 1; flex-direction: column; width: 100%; height: 100%;
    position: absolute; inset: 0;
  }
  .tab-pane.visible { display: flex; }

  .splash {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 0.75rem; color: var(--text-2); text-align: center; padding: 2rem;
  }
  .splash h1 {
    font-size: 1.75rem; font-weight: 700; color: var(--text-1); letter-spacing: -0.03em;
  }
  .splash p { font-size: 0.875rem; }
  .private-note {
    display: flex; align-items: center; gap: 0.4rem;
    color: #a78bfa !important; font-size: 0.8rem !important;
    margin-top: 0.5rem;
  }
</style>
