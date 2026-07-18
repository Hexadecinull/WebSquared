<script lang="ts">
  import { settings, isMobile } from '../stores/settings';
  import { history } from '../stores/history';
  import { bookmarks } from '../stores/bookmarks';
  import { onlineCount } from '../stores/presence';

  let { onClose }: { onClose: () => void } = $props();

  const mobile = isMobile();

  type Theme = 'dark' | 'light' | 'system';
  type Engine = 'google' | 'bing' | 'duckduckgo' | 'brave' | 'ecosia';
  type FontSize = 'small' | 'medium' | 'large';
</script>

<div class="overlay" onclick={onClose} role="presentation"></div>
<div class="panel" role="dialog" aria-label="Settings">
  <header>
    <h2>Settings</h2>
    <button onclick={onClose} aria-label="Close settings">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </header>

  <section class="online-section">
    <div class="online-pill" title="People currently browsing through WebSquared">
      <span class="online-dot"></span>
      <span>{$onlineCount} {$onlineCount === 1 ? 'person' : 'people'} online</span>
    </div>
  </section>

  <section>
    <h3>Appearance</h3>
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

  <section>
    <h3>Browsing</h3>
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
      Save browsing history
      <input type="checkbox" checked={$settings.saveHistory} onchange={(e) => settings.set('saveHistory', (e.currentTarget as HTMLInputElement).checked)} />
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

  <section>
    <h3>Data</h3>
    <button class="danger-btn" onclick={() => history.clear()}>Clear history</button>
    <button class="danger-btn" onclick={() => bookmarks.clear()}>Clear bookmarks</button>
    <button class="danger-btn" onclick={() => { history.clear(); bookmarks.clear(); settings.reset(); }}>Reset all data</button>
  </section>

  <section>
    <h3>About</h3>
    <p class="about-line">WebSquared v0.1.0 — GPL-3.0</p>
    <p class="about-line">
      Created by SSMG4 and contributors
    </p>
    <p class="about-line">
      <a href="https://github.com/Hexadecinull/WebSquared" target="_blank" rel="noopener noreferrer">GitHub →</a>
    </p>
  </section>
</div>

<style>
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; }
  .panel {
    position: fixed; top: 0; right: 0; bottom: 0; width: 320px;
    background: var(--surface-1); border-left: 1px solid var(--border);
    z-index: 201; overflow-y: auto; display: flex; flex-direction: column;
    animation: slideIn 0.2s ease;
  }
  @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
  header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem; border-bottom: 1px solid var(--border); flex-shrink: 0;
    position: sticky; top: 0; background: var(--surface-1); z-index: 1;
  }
  h2 { font-size: 1rem; font-weight: 600; color: var(--text-1); }
  header button {
    display: flex; align-items: center; justify-content: center;
    width: 2rem; height: 2rem; border-radius: 6px;
    border: none; background: transparent; color: var(--text-2); cursor: pointer;
  }
  header button:hover { background: var(--surface-2); color: var(--text-1); }
  header button svg { width: 1rem; height: 1rem; }
  section { padding: 1rem; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 0.75rem; }
  h3 { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-3); margin-bottom: 0.125rem; }
  label {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 0.875rem; color: var(--text-1); gap: 1rem;
  }
  .toggle-row { cursor: pointer; }
  select {
    background: var(--surface-2); border: 1px solid var(--border);
    color: var(--text-1); border-radius: 6px; padding: 0.25rem 0.5rem;
    font-size: 0.8rem; font-family: inherit; cursor: pointer; flex-shrink: 0;
  }
  input[type="checkbox"] { width: 1rem; height: 1rem; cursor: pointer; accent-color: var(--accent); flex-shrink: 0; }
  .danger-btn {
    width: 100%; padding: 0.5rem; border-radius: 6px;
    border: 1px solid #f85149; background: transparent;
    color: #f85149; font-size: 0.8rem; font-family: inherit; cursor: pointer;
    transition: background 0.15s;
  }
  .danger-btn:hover { background: rgba(248, 81, 73, 0.1); }
  .about-line { font-size: 0.8rem; color: var(--text-2); }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  .online-section {
    display: flex;
    justify-content: center;
    padding: 0.875rem 1rem;
  }
  .online-pill {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    background: rgba(63, 185, 80, 0.12);
    border: 1px solid rgba(63, 185, 80, 0.35);
    color: #3fb950;
    font-size: 0.8rem;
    font-weight: 500;
  }
  .online-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: #3fb950;
    box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.6);
    animation: pulse 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes pulse {
    0% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.5); }
    50% { transform: scale(1.15); box-shadow: 0 0 0 4px rgba(63, 185, 80, 0); }
    100% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(63, 185, 80, 0); }
  }
</style>
