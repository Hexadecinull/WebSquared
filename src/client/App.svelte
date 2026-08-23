<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { tabs, activeTab } from './stores/tabs';
  import { bookmarks } from './stores/bookmarks';
  import { settings, FONT_SIZE_MAP, isMobile } from './stores/settings';
  import { connectPresence } from './stores/presence';
  import { mix, shade } from './lib/color';
  import URLBar from './components/URLBar.svelte';
  import NavButtons from './components/NavButtons.svelte';
  import TabBar from './components/TabBar.svelte';
  import ProxyFrame from './components/ProxyFrame.svelte';
  import BookmarksBar from './components/BookmarksBar.svelte';
  import SettingsPanel from './components/SettingsPanel.svelte';
  import DevToolsPanel from './components/DevToolsPanel.svelte';
  import BookmarkPopup from './components/BookmarkPopup.svelte';
  import type { Bookmark } from './stores/bookmarks';

  let showSettings = $state(false);
  let swReady = $state(false);

  let frameRefs = $state<Record<string, ProxyFrame>>({});
  let frameLoading = $derived($activeTab?.loading ?? false);
  let canBack = $derived($activeTab?.canBack ?? false);
  let canForward = $derived($activeTab?.canForward ?? false);

  function getActiveFrame(): ProxyFrame | undefined {
    return $activeTab ? frameRefs[$activeTab.id] : undefined;
  }

  function getActiveIframe(): HTMLIFrameElement | undefined {
    return getActiveFrame()?.getIframe();
  }

  const TINTABLE_VARS = ['--bg', '--surface-1', '--surface-2', '--border'] as const;

  function applyTheme(s: typeof $settings) {
    const root = document.documentElement;

    // Clear any previous deeper-accent overrides first, so the read below
    // picks up the plain theme's own baseline rather than last time's tint.
    for (const name of TINTABLE_VARS) root.style.removeProperty(name);

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolvedTheme =
      s.theme === 'system' ? (prefersDark ? 'dark' : 'light') : s.theme;
    root.setAttribute('data-theme', resolvedTheme);

    root.style.setProperty('--accent', s.accent);
    root.style.setProperty('--accent-hover', shade(s.accent, 0.12));

    if (s.deeperAccent) {
      const tintRatio = resolvedTheme === 'light' ? 0.06 : 0.1;
      const computed = getComputedStyle(root);
      for (const name of TINTABLE_VARS) {
        const base = computed.getPropertyValue(name).trim();
        if (base) root.style.setProperty(name, mix(base, s.accent, tintRatio));
      }
    }

    root.style.fontSize = FONT_SIZE_MAP[s.fontSize];
    root.style.scrollBehavior = s.smoothScrolling ? 'smooth' : 'auto';
  }

  $effect(() => { applyTheme($settings); });

  // The content-filter settings live in localStorage, so the server can't
  // see them directly; mirror them onto plain, unnamespaced cookies on the
  // top-level page, which ride along with every same-origin /w2/ request.
  $effect(() => {
    const flags: Record<string, boolean> = {
      w2_block_ads: $settings.blockAds,
      w2_block_adult: $settings.blockAdult,
      w2_block_gambling: $settings.blockGambling,
      w2_block_malware: $settings.blockMalware,
    };
    for (const [name, on] of Object.entries(flags)) {
      document.cookie = `${name}=${on ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
    }
  });

  async function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register('/w2-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      swReady = true;
    } catch { /* non-fatal */ }
  }

  onMount(() => {
    registerSW();
    connectPresence();
  });

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

  let editingBookmark = $state<Bookmark | undefined>(undefined);

  function handleBookmarkClick() {
    const tab = $activeTab;
    if (!tab?.url) return;
    const existing = bookmarks.getByUrl(tab.url);
    if (existing) {
      editingBookmark = existing;
      return;
    }
    const id = bookmarks.add(tab.url, tab.title, tab.favicon);
    editingBookmark = bookmarks.getByUrl(tab.url) ?? { id, url: tab.url, title: tab.title, favicon: tab.favicon, addedAt: Date.now(), folderId: null };
  }

  let isBookmarked = $derived(
    $activeTab ? $bookmarks.some((b) => b.url === $activeTab.url) : false,
  );

  const mobile = isMobile();
  let mobileSearchOpen = $state(false);
  let mobileUrlBarRef = $state<URLBar>();

  async function openMobileSearch() {
    mobileSearchOpen = true;
    await tick();
    mobileUrlBarRef?.focusInput();
  }

  function closeMobileSearch() {
    mobileSearchOpen = false;
  }

  function onMobileSearchNavigate(url: string) {
    navigate(url);
    closeMobileSearch();
  }

  function onShellKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && mobileSearchOpen) closeMobileSearch();
  }
</script>

<svelte:window onkeydown={onShellKeydown} />

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
      onBack={goBack}
      onForward={goForward}
      onRefresh={refresh}
    />

    {#if mobile}
      {#if !mobileSearchOpen}
        <button class="icon-btn search-toggle" onclick={openMobileSearch} title="Search" aria-label="Search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
      {/if}
    {:else}
      <URLBar
        url={$activeTab?.url ?? ''}
        onNavigate={(url) => navigate(url)}
        bookmarked={isBookmarked}
        onBookmarkClick={handleBookmarkClick}
      />
    {/if}

    <div class="toolbar-end">
      <button
        class="icon-btn"
        onclick={() => openNewTab('', true)}
        title="New private tab"
        aria-label="New private tab"
      >
<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.5,11.75 C20.1233526,11.75 22.25,13.8766474 22.25,16.5 C22.25,19.1233526 20.1233526,21.25 17.5,21.25 C15.4019872,21.25 13.6216629,19.8898135 12.9927596,18.0031729 L11.0072404,18.0031729 C10.3783371,19.8898135 8.59801283,21.25 6.5,21.25 C3.87664744,21.25 1.75,19.1233526 1.75,16.5 C1.75,13.8766474 3.87664744,11.75 6.5,11.75 C8.9545808,11.75 10.9743111,13.6118164 11.224028,16.0002862 L12.775972,16.0002862 C13.0256889,13.6118164 15.0454192,11.75 17.5,11.75 Z M6.5,13.75 C4.98121694,13.75 3.75,14.9812169 3.75,16.5 C3.75,18.0187831 4.98121694,19.25 6.5,19.25 C8.01878306,19.25 9.25,18.0187831 9.25,16.5 C9.25,14.9812169 8.01878306,13.75 6.5,13.75 Z M17.5,13.75 C15.9812169,13.75 14.75,14.9812169 14.75,16.5 C14.75,18.0187831 15.9812169,19.25 17.5,19.25 C19.0187831,19.25 20.25,18.0187831 20.25,16.5 C20.25,14.9812169 19.0187831,13.75 17.5,13.75 Z M15.5119387,3 C16.7263613,3 17.7969992,3.79658742 18.145961,4.95979331 L19.1520701,8.31093387 C19.944619,8.44284508 20.7202794,8.59805108 21.4790393,8.77658283 C22.0166428,8.90307776 22.3499121,9.44143588 22.2234172,9.9790393 C22.0969222,10.5166428 21.5585641,10.8499121 21.0209607,10.7234172 C18.2654221,10.0750551 15.258662,9.75 12,9.75 C8.74133802,9.75 5.73457794,10.0750551 2.97903933,10.7234172 C2.44143588,10.8499121 1.90307776,10.5166428 1.77658283,9.9790393 C1.6500879,9.44143588 1.98335721,8.90307776 2.52096067,8.77658283 C3.27940206,8.59812603 4.05472975,8.4429754 4.8469317,8.31110002 L5.85403902,4.95979331 C6.20300079,3.79658742 7.2736387,3 8.4880613,3 L15.5119387,3 Z"/>
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

  {#if mobile && mobileSearchOpen}
    <div class="mobile-search-scrim" onclick={closeMobileSearch} role="presentation"></div>
    <div class="mobile-search-panel">
      <URLBar
        bind:this={mobileUrlBarRef}
        url={$activeTab?.url ?? ''}
        onNavigate={onMobileSearchNavigate}
        bookmarked={isBookmarked}
        onBookmarkClick={handleBookmarkClick}
      />
    </div>
  {/if}

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
            isPrivate={tab.private}
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.5,11.75 C20.1233526,11.75 22.25,13.8766474 22.25,16.5 C22.25,19.1233526 20.1233526,21.25 17.5,21.25 C15.4019872,21.25 13.6216629,19.8898135 12.9927596,18.0031729 L11.0072404,18.0031729 C10.3783371,19.8898135 8.59801283,21.25 6.5,21.25 C3.87664744,21.25 1.75,19.1233526 1.75,16.5 C1.75,13.8766474 3.87664744,11.75 6.5,11.75 C8.9545808,11.75 10.9743111,13.6118164 11.224028,16.0002862 L12.775972,16.0002862 C13.0256889,13.6118164 15.0454192,11.75 17.5,11.75 Z M6.5,13.75 C4.98121694,13.75 3.75,14.9812169 3.75,16.5 C3.75,18.0187831 4.98121694,19.25 6.5,19.25 C8.01878306,19.25 9.25,18.0187831 9.25,16.5 C9.25,14.9812169 8.01878306,13.75 6.5,13.75 Z M17.5,13.75 C15.9812169,13.75 14.75,14.9812169 14.75,16.5 C14.75,18.0187831 15.9812169,19.25 17.5,19.25 C19.0187831,19.25 20.25,18.0187831 20.25,16.5 C20.25,14.9812169 19.0187831,13.75 17.5,13.75 Z M15.5119387,3 C16.7263613,3 17.7969992,3.79658742 18.145961,4.95979331 L19.1520701,8.31093387 C19.944619,8.44284508 20.7202794,8.59805108 21.4790393,8.77658283 C22.0166428,8.90307776 22.3499121,9.44143588 22.2234172,9.9790393 C22.0969222,10.5166428 21.5585641,10.8499121 21.0209607,10.7234172 C18.2654221,10.0750551 15.258662,9.75 12,9.75 C8.74133802,9.75 5.73457794,10.0750551 2.97903933,10.7234172 C2.44143588,10.8499121 1.90307776,10.5166428 1.77658283,9.9790393 C1.6500879,9.44143588 1.98335721,8.90307776 2.52096067,8.77658283 C3.27940206,8.59812603 4.05472975,8.4429754 4.8469317,8.31110002 L5.85403902,4.95979331 C6.20300079,3.79658742 7.2736387,3 8.4880613,3 L15.5119387,3 Z"/>
        </svg>
                Private tab, history won't be saved.
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

{#if $settings.devToolsEnabled}
  <DevToolsPanel getIframe={getActiveIframe} />
{/if}

{#if editingBookmark}
  <BookmarkPopup bookmark={editingBookmark} onClose={() => { editingBookmark = undefined; }} />
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

  :global([data-theme="amoled"]) {
    --bg: #000000; --surface-1: #000000; --surface-2: #0a0a0a;
    --border: #1c1c1c; --text-1: #e6edf3; --text-2: #8b949e; --text-3: #484f58;
    --accent: #4f8ef7; --accent-hover: #3d7ae5; --radius: 0.5rem;
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

  .search-toggle {
    flex: 1; width: auto; justify-content: flex-start; padding-left: 0.6rem; gap: 0.5rem;
    color: var(--text-2); font-size: 0.85rem;
  }

  .mobile-search-scrim { position: fixed; inset: 0; z-index: 150; background: rgba(0, 0, 0, 0.35); }
  .mobile-search-panel {
    position: fixed; top: 3.25rem; left: 0.5rem; right: 0.5rem; z-index: 151;
    background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px;
    padding: 0.4rem; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  }

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
