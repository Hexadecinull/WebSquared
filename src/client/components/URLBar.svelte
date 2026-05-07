<script lang="ts">
  import { toProxyUrl } from '../../shared/url';

  let { onNavigate }: { onNavigate: (url: string) => void } = $props();

  let inputValue = $state('');
  let focused = $state(false);

  function normalizeUrl(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[a-z0-9-]+\.[a-z]{2,}/i.test(trimmed)) return 'https://' + trimmed;
    return 'https://www.google.com/search?q=' + encodeURIComponent(trimmed);
  }

  function navigate() {
    const url = normalizeUrl(inputValue);
    if (!url) return;
    const proxied = toProxyUrl(url);
    onNavigate(proxied);
    inputValue = url;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') navigate();
    if (e.key === 'Escape') (e.currentTarget as HTMLInputElement).blur();
  }

  function onFocus() {
    focused = true;
  }

  function onBlur() {
    focused = false;
  }
</script>

<div class="bar" class:focused>
  <svg
    class="icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
  <input
    type="text"
    placeholder="Enter a URL or search..."
    bind:value={inputValue}
    onkeydown={onKeydown}
    onfocus={onFocus}
    onblur={onBlur}
    autocomplete="off"
    autocorrect="off"
    autocapitalize="off"
    spellcheck={false}
  />
  <button onclick={navigate} aria-label="Go">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  </button>
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--surface-2);
    border: 1.5px solid var(--border);
    border-radius: 999px;
    padding: 0.35rem 0.5rem 0.35rem 0.875rem;
    transition: border-color 0.15s;
    flex: 1;
  }

  .bar.focused {
    border-color: var(--accent);
  }

  .icon {
    width: 1rem;
    height: 1rem;
    color: var(--text-2);
    flex-shrink: 0;
  }

  input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-1);
    font-size: 0.875rem;
    font-family: inherit;
    min-width: 0;
  }

  input::placeholder {
    color: var(--text-3);
  }

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    border: none;
    background: var(--accent);
    color: #fff;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s;
  }

  button:hover {
    background: var(--accent-hover);
  }

  button svg {
    width: 0.875rem;
    height: 0.875rem;
  }
</style>
