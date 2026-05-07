<script lang="ts">
  import URLBar from './components/URLBar.svelte';
  import ProxyFrame from './components/ProxyFrame.svelte';

  let proxySrc = $state('');
  let swReady = $state(false);
  let swError = $state('');

  async function registerSW() {
    if (!('serviceWorker' in navigator)) {
      swError = 'Service workers are not supported in this browser.';
      return;
    }
    try {
      const reg = await navigator.serviceWorker.register('/w2-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      swReady = true;

      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'activated') {
            location.reload();
          }
        });
      });
    } catch (err) {
      swError = `Service worker registration failed: ${(err as Error).message}`;
    }
  }

  registerSW();

  function navigate(url: string) {
    proxySrc = url;
  }
</script>

<div class="shell">
  <header class="toolbar">
    <a class="brand" href="/" aria-label="WebSquared home">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="2" width="9" height="9" rx="1.5" fill="var(--accent)" />
        <rect x="13" y="2" width="9" height="9" rx="1.5" fill="var(--accent)" opacity="0.6" />
        <rect x="2" y="13" width="9" height="9" rx="1.5" fill="var(--accent)" opacity="0.6" />
        <rect x="13" y="13" width="9" height="9" rx="1.5" fill="var(--accent)" />
      </svg>
      <span>Web²</span>
    </a>
    <URLBar onNavigate={navigate} />
    <div class="status" title={swReady ? 'Service worker active' : swError || 'Initialising…'}>
      <span class="dot" class:ready={swReady} class:error={!!swError}></span>
    </div>
  </header>

  <main class="viewport">
    {#if !proxySrc}
      <div class="splash">
        <svg width="64" height="64" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="2" y="2" width="9" height="9" rx="1.5" fill="var(--accent)" />
          <rect x="13" y="2" width="9" height="9" rx="1.5" fill="var(--accent)" opacity="0.6" />
          <rect x="2" y="13" width="9" height="9" rx="1.5" fill="var(--accent)" opacity="0.6" />
          <rect x="13" y="13" width="9" height="9" rx="1.5" fill="var(--accent)" />
        </svg>
        <h1>WebSquared</h1>
        <p>Enter a URL above to start browsing.</p>
        <p class="meta">
          Ad-free · Open source · <a
            href="https://github.com/Hexadecinull/WebSquared"
            target="_blank"
            rel="noopener noreferrer">GitHub</a
          >
        </p>
      </div>
    {:else}
      <ProxyFrame src={proxySrc} />
    {/if}
  </main>
</div>

<style>
  :global(*),
  :global(*::before),
  :global(*::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(:root) {
    --bg: #0f1117;
    --surface-1: #161b22;
    --surface-2: #1c2230;
    --border: #30363d;
    --text-1: #e6edf3;
    --text-2: #8b949e;
    --text-3: #484f58;
    --accent: #4f8ef7;
    --accent-hover: #3d7ae5;
    --radius: 0.5rem;
  }

  :global(html),
  :global(body) {
    height: 100%;
    background: var(--bg);
    color: var(--text-1);
    font-family:
      'Inter',
      system-ui,
      -apple-system,
      sans-serif;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  :global(a) {
    color: var(--accent);
    text-decoration: none;
  }

  :global(a:hover) {
    text-decoration: underline;
  }

  :global(#app) {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .shell {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.875rem;
    background: var(--surface-1);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    height: 3.25rem;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    color: var(--text-1);
    font-weight: 600;
    font-size: 1rem;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .brand span {
    font-size: 0.9rem;
    letter-spacing: -0.01em;
  }

  .status {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--text-3);
    transition: background 0.3s;
  }

  .dot.ready {
    background: #3fb950;
  }

  .dot.error {
    background: #f85149;
  }

  .viewport {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .splash {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: var(--text-2);
    text-align: center;
    padding: 2rem;
  }

  .splash h1 {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.03em;
  }

  .splash p {
    font-size: 0.9rem;
  }

  .meta {
    margin-top: 0.5rem;
    font-size: 0.8rem !important;
    color: var(--text-3) !important;
  }
</style>
