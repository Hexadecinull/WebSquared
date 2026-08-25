<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { settings, isMobile, DEFAULT_ACCENT } from '../stores/settings';
  import { history } from '../stores/history';
  import { bookmarks } from '../stores/bookmarks';
  import { tabs } from '../stores/tabs';
  import { onlineCount } from '../stores/presence';
  import Toggle from './Toggle.svelte';
  import HistoryManager from './HistoryManager.svelte';
  import BookmarksManager from './BookmarksManager.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import LegalDocViewer from './LegalDocViewer.svelte';
  import ColorPicker from './ColorPicker.svelte';
  import termsDoc from '../../../docs/TERMS.md?raw';
  import privacyDoc from '../../../docs/PRIVACY.md?raw';
  import securityDoc from '../../../docs/SECURITY.md?raw';
  import conductDoc from '../../../docs/CODE_OF_CONDUCT.md?raw';
  import architectureDoc from '../../../docs/ARCHITECTURE.md?raw';
  import deployDoc from '../../../docs/DEPLOY.md?raw';

  let { onClose, onNavigate }: { onClose: () => void; onNavigate?: (url: string) => void } = $props();

  const mobile = isMobile();

  type Theme = 'dark' | 'light' | 'system' | 'amoled';
  type Engine = 'google' | 'bing' | 'duckduckgo' | 'brave' | 'ecosia' | 'qwant';
  type FontSize = 'small' | 'medium' | 'large';
  type Category = 'appearance' | 'browsing' | 'history' | 'bookmarks' | 'privacy' | 'developer' | 'about';

  let activeCategory = $state<Category>('appearance');

  let pendingConfirm = $state<'history' | 'bookmarks' | 'reset' | null>(null);
  let openLegalDoc = $state<{ title: string; content: string } | null>(null);
  let colorPickerOpen = $state(false);

  function confirmPending() {
    if (pendingConfirm === 'history') history.clear();
    else if (pendingConfirm === 'bookmarks') bookmarks.clear();
    else if (pendingConfirm === 'reset') { history.clear(); bookmarks.clear(); tabs.forgetPersisted(); settings.reset(); }
    pendingConfirm = null;
  }

  function setRestoreTabs(v: boolean) {
    settings.set('restoreTabsOnStartup', v);
    if (!v) tabs.forgetPersisted();
  }

  const CATEGORIES: { id: Category; label: string; icon: string }[] = [
    { id: 'appearance', label: 'Appearance', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.36 6.36l-.7-.7M6.34 6.34l-.7-.7m12.02 0l-.7.7M6.34 17.66l-.7.7M12 7a5 5 0 100 10 5 5 0 000-10z' },
    { id: 'browsing', label: 'Browsing', icon: 'M3 12a9 9 0 1018 0 9 9 0 00-18 0zm9-9v18M3 12h18' },
    { id: 'history', label: 'History', icon: 'M3 3v5h5M3.05 13a9 9 0 106.2-8.7L3 8m9-3v5l4 2' },
    { id: 'bookmarks', label: 'Bookmarks', icon: 'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z' },
    { id: 'privacy', label: 'Data & Privacy', icon: 'M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z' },
    { id: 'developer', label: 'Developer', icon: 'M16 18l6-6-6-6M8 6l-6 6 6 6' },
    { id: 'about', label: 'About', icon: 'M12 16v-4m0-4h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0z' },
  ];
</script>

<div class="overlay" onclick={onClose} role="presentation" transition:fade={{ duration: 150 }}></div>
<div class="modal" role="dialog" aria-label="Settings" transition:fly={{ y: 16, duration: 180 }}>
  <header>
    <h2>Settings</h2>
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
      {#key activeCategory}
      <div class="category-panel" in:fly={{ x: 8, duration: 140 }} out:fade={{ duration: 80 }}>
      {#if activeCategory === 'appearance'}
        <section>
          <label>
            Theme
            <select value={$settings.theme} onchange={(e) => settings.set('theme', (e.currentTarget as HTMLSelectElement).value as Theme)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="amoled">AMOLED</option>
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
            <Toggle checked={$settings.smoothScrolling} onChange={(v) => settings.set('smoothScrolling', v)} ariaLabel="Smooth scrolling" />
          </label>
          <label>
            Accent
            <span class="accent-row">
              <button
                class="accent-swatch"
                style="background: {$settings.accent}"
                onclick={() => (colorPickerOpen = !colorPickerOpen)}
                aria-label="Choose accent color"
                aria-haspopup="dialog"
              ></button>
              {#if $settings.accent !== DEFAULT_ACCENT}
                <button class="mini-reset" onclick={() => settings.set('accent', DEFAULT_ACCENT)}>Reset</button>
              {/if}
              {#if colorPickerOpen}
                <ColorPicker
                  value={$settings.accent}
                  onChange={(hex) => settings.set('accent', hex)}
                  onClose={() => (colorPickerOpen = false)}
                />
              {/if}
            </span>
          </label>
          <label class="toggle-row">
            Deeper accent
            <Toggle checked={$settings.deeperAccent} onChange={(v) => settings.set('deeperAccent', v)} ariaLabel="Deeper accent" />
          </label>
          <p class="hint">Deeper accent tints the background, panels, and borders with your accent color too, instead of just buttons and links.</p>
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
              <option value="qwant">Qwant</option>
            </select>
          </label>
          <label class="toggle-row">
            Open links in new tab
            <Toggle checked={$settings.openLinksInNewTab} onChange={(v) => settings.set('openLinksInNewTab', v)} ariaLabel="Open links in new tab" />
          </label>
          <label class="toggle-row">
            Block ads
            <Toggle checked={$settings.blockAds} onChange={(v) => settings.set('blockAds', v)} ariaLabel="Block ads" />
          </label>
          <p class="hint">Blocks known ad and tracker domains at the proxy level before they're ever fetched.</p>
          <label class="toggle-row">
            Block adult content
            <Toggle checked={$settings.blockAdult} onChange={(v) => settings.set('blockAdult', v)} ariaLabel="Block adult content" />
          </label>
          <label class="toggle-row">
            Block gambling content
            <Toggle checked={$settings.blockGambling} onChange={(v) => settings.set('blockGambling', v)} ariaLabel="Block gambling content" />
          </label>
          <label class="toggle-row">
            Block malicious &amp; phishing sites
            <Toggle checked={$settings.blockMalware} onChange={(v) => settings.set('blockMalware', v)} ariaLabel="Block malicious and phishing sites" />
          </label>
          <label class="toggle-row">
            Block clickbait &amp; low-quality content
            <Toggle checked={$settings.blockClickbait} onChange={(v) => settings.set('blockClickbait', v)} ariaLabel="Block clickbait and low-quality content" />
          </label>
          <p class="hint">These use community-maintained domain lists (in the same style as uBlock Origin's) and update automatically. Malicious/phishing blocking defaults on since it protects this server too, not just your browsing.</p>
          {#if mobile}
            <label class="toggle-row">
              Desktop mode
              <Toggle checked={$settings.desktopMode} onChange={(v) => settings.set('desktopMode', v)} ariaLabel="Desktop mode" />
            </label>
          {/if}
        </section>
      {:else if activeCategory === 'history'}
        <section>
          <HistoryManager onNavigate={onNavigate} />
          {#if $history.length > 0}
            <button class="danger-btn" onclick={() => (pendingConfirm = 'history')}>Clear all history</button>
          {/if}
        </section>
      {:else if activeCategory === 'bookmarks'}
        <section>
          <BookmarksManager />
          {#if $bookmarks.length > 0}
            <button class="danger-btn" onclick={() => (pendingConfirm = 'bookmarks')}>Clear all bookmarks</button>
          {/if}
        </section>
      {:else if activeCategory === 'privacy'}
        <section>
          <label class="toggle-row">
            Save browsing history
            <Toggle checked={$settings.saveHistory} onChange={(v) => settings.set('saveHistory', v)} ariaLabel="Save browsing history" />
          </label>
          <label class="toggle-row">
            Remember open tabs
            <Toggle checked={$settings.restoreTabsOnStartup} onChange={setRestoreTabs} ariaLabel="Remember open tabs" />
          </label>
          <p class="hint">Off by default: WebSquared opens to a single new tab each time. Turn this on to reopen your previous tabs instead.</p>
          <button class="danger-btn" onclick={() => (pendingConfirm = 'reset')}>Reset all data</button>
        </section>
      {:else if activeCategory === 'developer'}
        <section>
          <label class="toggle-row">
            Enable DevTools
            <Toggle checked={$settings.devToolsEnabled} onChange={(v) => settings.set('devToolsEnabled', v)} ariaLabel="Enable DevTools" />
          </label>
          <p class="hint">
            Adds a floating button for a lightweight console and network log of
            the site you're currently browsing.
            {#if !mobile}
              On desktop, your browser's own DevTools (F12) already give you
              this and far more. This is mainly useful on mobile, where
              there's no built-in equivalent.
            {/if}
          </p>
          <label class="toggle-row">
            Verbose console logging
            <Toggle checked={$settings.verboseLogging} onChange={(v) => settings.set('verboseLogging', v)} ariaLabel="Verbose console logging" />
          </label>
          <p class="hint">Logs every navigation WebSquared rewrites (links, redirects, pushState) to the real browser DevTools console of the page you're viewing, prefixed with [w2].</p>
          <label class="toggle-row">
            Expose debug helpers
            <Toggle checked={$settings.exposeDebugHelpers} onChange={(v) => settings.set('exposeDebugHelpers', v)} ariaLabel="Expose debug helpers" />
          </label>
          <p class="hint">Attaches <code>window.__websquared</code> (real URL, proxy origin, and the URL-rewriting functions) to every proxied page, for poking around in the real DevTools console.</p>
        </section>
      {:else if activeCategory === 'about'}
        <section>
          <div class="online-pill" title="People currently browsing through WebSquared">
            <span class="online-dot"></span>
            <span>{$onlineCount} {$onlineCount === 1 ? 'person' : 'people'} online</span>
          </div>

          <p class="about-body">
            WebSquared is a web proxy: point it at a site and it fetches, rewrites,
            and streams that page back through this one server, so the page runs
            as if it were served from here. No account, no data collection by
            design, and no ads baked into the product itself.
          </p>

          <h4 class="about-heading">What it does</h4>
          <ul class="about-list">
            <li>Rewrites HTML, CSS, and JS on the fly so links, forms, cookies, and scripts keep working through the proxy</li>
            <li>Optional ad, adult, gambling, malware/phishing, and clickbait filtering, using community-maintained domain lists that refresh automatically</li>
            <li>Tabs, bookmarks, history, and private browsing, all kept locally in your browser rather than on the server</li>
            <li>A built-in TCP tunnel (Wisp protocol) for traffic that needs a raw socket rather than plain HTTP</li>
          </ul>

          <h4 class="about-heading">Built with</h4>
          <p class="about-body">
            Svelte 5 and TypeScript on the frontend, Express on the backend, and
            cheerio for HTML rewriting. See <button class="inline-link" onclick={() => (openLegalDoc = { title: 'Architecture', content: architectureDoc })}>Architecture</button>
            for the full technical breakdown of how a request actually flows through the system.
          </p>

          <h4 class="about-heading">Self-hosting</h4>
          <p class="about-body">
            WebSquared is meant to be self-hosted. This instance is one of
            (potentially many) independent deployments of the same open-source
            project; see <button class="inline-link" onclick={() => (openLegalDoc = { title: 'Self-hosting WebSquared', content: deployDoc })}>the deploy guide</button>
            if you'd like to run your own.
          </p>

          <p class="about-line">WebSquared v{__APP_VERSION__}, AGPL-3.0</p>
          <p class="about-line">Created by SSMG4 and contributors</p>
          <p class="about-line">
            <a href="https://github.com/Hexadecinull/WebSquared" target="_blank" rel="noopener noreferrer">GitHub →</a>
          </p>
          <div class="legal-links">
            <button class="legal-btn" onclick={() => (openLegalDoc = { title: 'Terms of Service', content: termsDoc })}>Terms of Service</button>
            <button class="legal-btn" onclick={() => (openLegalDoc = { title: 'Privacy Policy', content: privacyDoc })}>Privacy Policy</button>
            <button class="legal-btn" onclick={() => (openLegalDoc = { title: 'Security Policy', content: securityDoc })}>Security Policy</button>
            <button class="legal-btn" onclick={() => (openLegalDoc = { title: 'Code of Conduct', content: conductDoc })}>Code of Conduct</button>
          </div>
        </section>
      {/if}
      </div>
      {/key}
    </div>
  </div>
</div>

{#if pendingConfirm === 'history'}
  <ConfirmDialog
    message="Clear all browsing history? This can't be undone."
    confirmLabel="Clear history"
    onConfirm={confirmPending}
    onCancel={() => (pendingConfirm = null)}
  />
{:else if pendingConfirm === 'bookmarks'}
  <ConfirmDialog
    message="Clear all bookmarks and folders? This can't be undone."
    confirmLabel="Clear bookmarks"
    onConfirm={confirmPending}
    onCancel={() => (pendingConfirm = null)}
  />
{:else if pendingConfirm === 'reset'}
  <ConfirmDialog
    message="Reset all WebSquared data, including history, bookmarks, and settings? This can't be undone."
    confirmLabel="Reset everything"
    onConfirm={confirmPending}
    onCancel={() => (pendingConfirm = null)}
  />
{/if}

{#if openLegalDoc}
  <LegalDocViewer title={openLegalDoc.title} content={openLegalDoc.content} onClose={() => (openLegalDoc = null)} />
{/if}

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
  .close-btn {
    display: flex; align-items: center; justify-content: center;
    width: 2rem; height: 2rem; border-radius: 6px; flex-shrink: 0; margin-left: auto;
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
  .category-panel { display: block; }
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
  .danger-btn {
    width: 100%; padding: 0.55rem; border-radius: 8px;
    border: 1px solid #f85149; background: transparent;
    color: #f85149; font-size: 0.8rem; font-family: inherit; cursor: pointer;
    transition: background 0.15s;
  }
  .danger-btn:hover { background: rgba(248, 81, 73, 0.1); }
  .hint { font-size: 0.78rem; color: var(--text-2); line-height: 1.5; margin-top: -0.4rem; }
  .hint code {
    background: var(--surface-2); border: 1px solid var(--border); border-radius: 4px;
    padding: 0.05rem 0.3rem; font-family: 'SF Mono', Consolas, monospace; font-size: 0.9em;
  }
  .about-line { font-size: 0.8rem; color: var(--text-2); }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  .about-body { font-size: 0.82rem; color: var(--text-2); line-height: 1.6; margin: 0 0 0.4rem; }
  .about-heading {
    font-size: 0.75rem; font-weight: 700; color: var(--text-3);
    text-transform: uppercase; letter-spacing: 0.04em; margin: 0.5rem 0 0.2rem;
  }
  .about-list {
    display: flex; flex-direction: column; gap: 0.4rem; margin: 0 0 0.4rem 1.1rem;
    font-size: 0.82rem; color: var(--text-2); line-height: 1.5;
  }
  .inline-link {
    background: none; border: none; padding: 0; margin: 0; cursor: pointer;
    color: var(--accent); font-size: inherit; font-family: inherit;
    text-decoration: underline; text-underline-offset: 2px;
  }
  .inline-link:hover { color: var(--accent-hover); }

  .accent-row { position: relative; display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
  .accent-swatch {
    width: 2rem; height: 1.5rem; padding: 0; border: 1px solid var(--border);
    border-radius: 6px; cursor: pointer; transition: transform 0.1s;
  }
  .accent-swatch:hover { transform: scale(1.06); }
  .mini-reset {
    border: none; background: transparent; color: var(--text-2);
    font-size: 0.72rem; cursor: pointer; text-decoration: underline;
  }
  .mini-reset:hover { color: var(--text-1); }

  .legal-links { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.4rem; }
  .legal-btn {
    padding: 0.4rem 0.7rem; border-radius: 7px; border: 1px solid var(--border);
    background: var(--surface-2); color: var(--text-1); font-size: 0.75rem;
    font-family: inherit; cursor: pointer; transition: background 0.15s;
  }
  .legal-btn:hover { background: var(--border); }

  .online-pill {
    display: inline-flex; align-items: center; gap: 0.4rem; width: fit-content;
    padding: 0.3rem 0.7rem; border-radius: 999px; margin-bottom: 0.3rem;
    background: rgba(63, 185, 80, 0.12); border: 1px solid rgba(63, 185, 80, 0.35);
    color: #3fb950; font-size: 0.75rem; font-weight: 500;
  }
  .online-dot {
    width: 0.45rem; height: 0.45rem; border-radius: 50%; background: #3fb950;
    animation: pulse 1.8s ease-in-out infinite; flex-shrink: 0;
  }
  @keyframes pulse {
    0% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.5); }
    50% { transform: scale(1.15); box-shadow: 0 0 0 4px rgba(63, 185, 80, 0); }
    100% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(63, 185, 80, 0); }
  }

  @media (max-width: 640px) {
    .modal {
      top: 0; left: 0; transform: none;
      width: 100vw; height: 100vh; height: 100dvh;
      border-radius: 0; border: none;
    }
    .modal-body { flex-direction: column; }
    .category-nav {
      width: 100%; flex-direction: row; overflow-x: auto; overflow-y: visible;
      border-right: none; border-bottom: 1px solid var(--border); padding: 0.6rem;
    }
    .category-nav button { flex-shrink: 0; }
    .category-nav button span { display: none; }
    .category-content { padding: 1rem; }
  }
</style>
