<script lang="ts">
  import { history } from '../stores/history';
  import { settings, SEARCH_URLS } from '../stores/settings';

  let {
    url = '',
    onNavigate,
  }: { url?: string; onNavigate: (url: string) => void } = $props();

  let inputValue = $state(url ?? '');
  let focused = $state(false);
  let suggestions = $state<import('../stores/history').HistoryEntry[]>([]);
  let selectedIndex = $state(-1);

  $effect(() => { inputValue = url; });

  function normalizeUrl(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[a-z0-9-]+(\.[a-z]{2,})+/i.test(trimmed)) return 'https://' + trimmed;
    return SEARCH_URLS[$settings.searchEngine] + encodeURIComponent(trimmed);
  }

  function navigate(raw?: string) {
    const target = normalizeUrl(raw ?? inputValue);
    if (!target) return;
    inputValue = target;
    suggestions = [];
    selectedIndex = -1;
    onNavigate(target);
  }

  function onInput(e: Event) {
    const val = (e.currentTarget as HTMLInputElement).value;
    inputValue = val;
    suggestions = history.suggest(val);
    selectedIndex = -1;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        navigate(suggestions[selectedIndex].url);
      } else {
        navigate();
      }
      (e.currentTarget as HTMLInputElement).blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
    } else if (e.key === 'Escape') {
      suggestions = [];
      selectedIndex = -1;
      (e.currentTarget as HTMLInputElement).blur();
    }
  }

  function onFocus(e: FocusEvent) {
    focused = true;
    (e.currentTarget as HTMLInputElement).select();
  }

  function onBlur() {
    focused = false;
    setTimeout(() => { suggestions = []; selectedIndex = -1; }, 150);
  }

  function pickSuggestion(url: string) {
    navigate(url);
  }
</script>

<div class="bar-wrap">
  <div class="bar" class:focused>
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input
      type="text"
      placeholder="Enter a URL or search..."
      value={inputValue}
      oninput={onInput}
      onkeydown={onKeydown}
      onfocus={onFocus}
      onblur={onBlur}
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck={false}
    />
    <button onclick={() => navigate()} aria-label="Go">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  </div>
  {#if suggestions.length > 0 && focused}
    <ul class="suggestions">
      {#each suggestions as s, i}
        <li class:selected={i === selectedIndex}>
          <button onmousedown={() => pickSuggestion(s.url)}>
            {#if s.favicon}
              <img src={s.favicon} alt="" class="sfav" width="14" height="14" />
            {:else}
              <span class="sfav-placeholder"></span>
            {/if}
            <span class="surl">{s.url}</span>
            {#if s.title && s.title !== s.url}
              <span class="stitle">{s.title}</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .bar-wrap {
    position: relative;
    flex: 1;
    min-width: 0;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--surface-2);
    border: 1.5px solid var(--border);
    border-radius: 999px;
    padding: 0.35rem 0.5rem 0.35rem 0.875rem;
    transition: border-color 0.15s;
  }
  .bar.focused { border-color: var(--accent); }
  .icon { width: 1rem; height: 1rem; color: var(--text-2); flex-shrink: 0; }
  input {
    flex: 1; background: transparent; border: none; outline: none;
    color: var(--text-1); font-size: 0.875rem; font-family: inherit; min-width: 0;
  }
  input::placeholder { color: var(--text-3); }
  button {
    display: flex; align-items: center; justify-content: center;
    width: 1.75rem; height: 1.75rem; border-radius: 50%;
    border: none; background: var(--accent); color: #fff;
    cursor: pointer; flex-shrink: 0; transition: background 0.15s;
  }
  button:hover { background: var(--accent-hover); }
  button svg { width: 0.875rem; height: 0.875rem; }
  .suggestions {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0;
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: var(--radius); list-style: none;
    z-index: 100; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }
  .suggestions li button {
    display: flex; align-items: center; gap: 0.5rem;
    width: 100%; padding: 0.5rem 0.75rem;
    background: transparent; border: none; border-radius: 0;
    color: var(--text-1); cursor: pointer; text-align: left;
  }
  .suggestions li.selected button,
  .suggestions li button:hover { background: var(--surface-2); }
  .sfav { width: 14px; height: 14px; flex-shrink: 0; }
  .sfav-placeholder { width: 14px; height: 14px; flex-shrink: 0; }
  .surl { font-size: 0.8rem; color: var(--accent); flex-shrink: 0; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stitle { font-size: 0.75rem; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
