<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { settings, isMobile } from '../stores/settings';
  import { history } from '../stores/history';
  import { bookmarks } from '../stores/bookmarks';
  import { onlineCount } from '../stores/presence';

  let { onClose }: { onClose: () => void } = $props();

  const mobile = isMobile();

  type Theme = 'dark' | 'light' | 'system';
  type Engine = 'google' | 'bing' | 'duckduckgo' | 'brave' | 'ecosia';
  type FontSize = 'small' | 'medium' | 'large';
  type Category = 'appearance' | 'browsing' | 'privacy' | 'developer' | 'about';

  let activeCategory = $state<Category>('appearance');

  const CATEGORIES: { id: Category; label: string; icon: string }[] = [
    { id: 'appearance', label: 'Appearance', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.36 6.36l-.7-.7M6.34 6.34l-.7-.7m12.02 0l-.7.7M6.34 17.66l-.7.7M12 7a5 5 0 100 10 5 5 0 000-10z' },
    { id: 'browsing', label: 'Browsing', icon: 'M3 12a9 9 0 1018 0 9 9 0 00-18 0zm9-9v18M3 12h18' },
    { id: 'privacy', label: 'Data & Privacy', icon: 'M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z' },
    { id: 'developer', label: 'Developer', icon: 'M16 18l6-6-6-6M8 6l-6 6 6 6' },
    { id: 'about', label: 'About', icon: 'M12 16v-4m0-4h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0z' },
  ];
</script>

<div class="overlay" onclick={onClose} role="presentation" transition:fade={{ duration: 150 }}></div>
<div class="modal" role="dialog" aria-label="Settings" transition:fly={{ y: 16, duration: 180 }}>
  <header>
    <h2>Settings</h2>
    <div class="online-pill" title="People currently browsing through WebSquared">
      <span class="online-dot"></span>
      <span>{$onlineCount} {$onlineCount === 1 ? 'person' : 'people'} online</span>
    </div>
    <button class="close-btn" onclick={onClose} aria-label="Close settings">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </header>

  <div class="modal-body">
    <nav class="category-nav">
      {#each CATEGORIES as cat (cat.id)}
        <button class:active={activeCategory === cat.id} onclick={() => (activeCategory = cat.id)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d={cat.icon}/>
          </svg>
          <span>{cat.label}</span>
        </button>
      {/each}
    </nav>

    <div class="category-content">
      {#if activeCategory === 'appearance'}
        <section>
          <label>
            Theme
            <select value={$settings.theme} onchange={(e) => settings.set('theme', (e.currentTarget as HTMLSelectElement).value as Theme)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </label>
          <label>
            Font size
            <select value={$settings.fontSize} onchange={(e) => settings.set('fontSize', (e.currentTarget as HTMLSelectElement).value as FontSize)}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
          <label class="toggle-row">
            Smooth scrolling
            <input type="checkbox" checked={$settings.smoothScrolling} onchange={(e) => settings.set('smoothScrolling', (e.currentTarget as HTMLInputElement).checked)} />
          </label>
        </section>
      {:else if activeCategory === 'browsing'}
        <section>
          <label>
            Search engine
            <select value={$settings.searchEngine} onchange={(e) => settings.set('searchEngine', (e.currentTarget as HTMLSelectElement).value as Engine)}>
              <option value="google">Google</option>
              <option value="bing">Bing</option>
              <option value="duckduckgo">DuckDuckGo</option>
              <option value="brave">Brave Search</option>
              <option value="ecosia">Ecosia</option>
            </select>
          </label>
          <label class="toggle-row">
            Open links in new tab
            <input type="checkbox" checked={$settings.openLinksInNewTab} onchange={(e) => settings.set('openLinksInNewTab', (e.currentTarget as HTMLInputElement).checked)} />
          </label>
          <label class="toggle-row">
            Block ads (experimental)
            <input type="checkbox" checked={$settings.blockAds} onchange={(e) => settings.set('blockAds', (e.currentTarget as HTMLInputElement).checked)} />
          </label>
          {#if mobile}
            <label class="toggle-row">
              Desktop mode
              <input type="checkbox" checked={$settings.desktopMode} onchange={(e) => settings.set('desktopMode', (e.currentTarget as HTMLInputElement).checked)} />
            </label>
          {/if}
        </section>
      {:else if activeCategory === 'privacy'}
        <section>
          <label class="toggle-row">
            Save browsing history
            <input type="checkbox" checked={$settings.saveHistory} onchange={(e) => settings.set('saveHistory', (e.currentTarget as HTMLInputElement).checked)} />
          </label>
          <button class="danger-btn" onclick={() => history.clear()}>Clear history</button>
          <button class="danger-btn" onclick={() => bookmarks.clear()}>Clear bookmarks</button>
          <button class="danger-btn" onclick={() => { history.clear(); bookmarks.clear(); settings.reset(); }}>Reset all data</button>
        </section>
      {:else if activeCategory === 'developer'}
        <section>
          <label class="toggle-row">
            Enable DevTools
            <input
              type="checkbox"
              checked={$settings.devToolsEnabled}
              onchange={(e) => settings.set('devToolsEnabled', (e.currentTarget as HTMLInputElement).checked)}
            />
          </label>
          <p class="hint">
            Adds a floating button for a lightweight console and network log of
            the site you're currently browsing.
            {#if !mobile}
              On desktop, your browser's own DevTools (F12) already give you
              this and far more — this is mainly useful on mobile, where
              there's no built-in equivalent.
            {/if}
          </p>
        </section>
      {:else if activeCategory === 'about'}
        <section>
          <p class="about-line">WebSquared — GPL-3.0</p>
          <p class="about-line">Created by SSMG4 and contributors</p>
          <p class="about-line">
            <a href="https://github.com/Hexadecinull/WebSquared" target="_blank" rel="noopener noreferrer">GitHub →</a>
          </p>
        </section>
      {/if}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(6px);
  }
  .modal {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 201; width: min(680px, calc(100vw - 2rem)); height: min(560px, calc(100vh - 4rem));
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    display: flex; flex-direction: column; overflow: hidden;
  }
  header {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  h2 { font-size: 1rem; font-weight: 600; color: var(--text-1); }
  .online-pill {
    display: flex; align-items: center; gap: 0.4rem; margin-left: auto;
    padding: 0.3rem 0.7rem; border-radius: 999px;
    background: rgba(63, 185, 80, 0.12); border: 1px solid rgba(63, 185, 80, 0.35);
    color: #3fb950; font-size: 0.72rem; font-weight: 500;
  }
  .online-dot {
    width: 0.4rem; height: 0.4rem; border-radius: 50%; background: #3fb950;
    animation: pulse 1.8s ease-in-out infinite; flex-shrink: 0;
  }
  @keyframes pulse {
    0% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.5); }
    50% { transform: scale(1.15); box-shadow: 0 0 0 4px rgba(63, 185, 80, 0); }
    100% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(63, 185, 80, 0); }
  }
  .close-btn {
    display: flex; align-items: center; justify-content: center;
    width: 2rem; height: 2rem; border-radius: 6px; flex-shrink: 0;
    border: none; background: transparent; color: var(--text-2); cursor: pointer;
  }
  .close-btn:hover { background: var(--surface-2); color: var(--text-1); }
  .close-btn svg { width: 1rem; height: 1rem; }

  .modal-body { flex: 1; display: flex; overflow: hidden; }
  .category-nav {
    width: 180px; flex-shrink: 0; border-right: 1px solid var(--border);
    display: flex; flex-direction: column; gap: 2px; padding: 0.75rem; overflow-y: auto;
  }
  .category-nav button {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.55rem 0.7rem; border-radius: 8px; text-align: left;
    border: none; background: transparent; color: var(--text-2);
    font-size: 0.82rem; cursor: pointer; transition: background 0.15s, color 0.15s;
  }
  .category-nav button:hover { background: var(--surface-2); color: var(--text-1); }
  .category-nav button.active { background: var(--surface-2); color: var(--accent); }
  .category-nav svg { width: 1rem; height: 1rem; flex-shrink: 0; }

  .category-content { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; }
  section { display: flex; flex-direction: column; gap: 0.9rem; }
  label {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 0.875rem; color: var(--text-1); gap: 1rem;
  }
  .toggle-row { cursor: pointer; }
  select {
    background: var(--surface-2); border: 1px solid var(--border);
    color: var(--text-1); border-radius: 6px; padding: 0.3rem 0.6rem;
    font-size: 0.8rem; font-family: inherit; cursor: pointer; flex-shrink: 0;
  }
  input[type="checkbox"] { width: 1rem; height: 1rem; cursor: pointer; accent-color: var(--accent); flex-shrink: 0; }
  .danger-btn {
    width: 100%; padding: 0.55rem; border-radius: 8px;
    border: 1px solid #f85149; background: transparent;
    color: #f85149; font-size: 0.8rem; font-family: inherit; cursor: pointer;
    transition: background 0.15s;
  }
  .danger-btn:hover { background: rgba(248, 81, 73, 0.1); }
  .hint { font-size: 0.78rem; color: var(--text-2); line-height: 1.5; }
  .about-line { font-size: 0.8rem; color: var(--text-2); }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  @media (max-width: 640px) {
    .modal { width: calc(100vw - 1.25rem); height: calc(100vh - 3rem); border-radius: 14px; }
    .modal-body { flex-direction: column; }
    .category-nav {
      width: 100%; flex-direction: row; overflow-x: auto; overflow-y: visible;
      border-right: none; border-bottom: 1px solid var(--border); padding: 0.6rem;
    }
    .category-nav button { flex-shrink: 0; }
    .category-nav button span { display: none; }
    .category-content { padding: 1rem; }
    .online-pill span { display: none; }
  }
</style>
