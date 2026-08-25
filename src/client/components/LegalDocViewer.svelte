<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { parseMarkdown, type InlineSegment } from '../lib/miniMarkdown';

  let { title, content, onClose }: { title: string; content: string; onClose: () => void } = $props();

  let blocks = $derived(parseMarkdown(content));

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

{#snippet inline(segments: InlineSegment[])}
  {#each segments as seg, i (i)}
    {#if seg.type === 'bold'}<strong>{seg.text}</strong>
    {:else if seg.type === 'code'}<code>{seg.text}</code>
    {:else if seg.type === 'link'}<a href={seg.href} target="_blank" rel="noopener noreferrer">{seg.text}</a>
    {:else}{seg.text}{/if}
  {/each}
{/snippet}

<svelte:window onkeydown={onKeydown} />

<div class="scrim" onclick={onClose} role="presentation" transition:fade={{ duration: 120 }}></div>
<div class="doc-modal" role="dialog" aria-label={title} transition:fly={{ y: 16, duration: 180 }}>
  <header>
    <h2>{title}</h2>
    <button class="close-btn" onclick={onClose} aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </header>
  <div class="doc-body">
    {#each blocks as block, i (i)}
      {#if block.type === 'heading'}
        {#if block.level === 2}<h3>{@render inline(block.segments)}</h3>
        {:else if block.level === 3}<h4>{@render inline(block.segments)}</h4>
        {:else}<h5>{@render inline(block.segments)}</h5>{/if}
      {:else if block.type === 'paragraph'}
        <p>{@render inline(block.segments)}</p>
      {:else if block.type === 'list'}
        <ul>
          {#each block.items as item, j (j)}
            <li>{@render inline(item)}</li>
          {/each}
        </ul>
      {:else if block.type === 'code-block'}
        <pre>{block.text}</pre>
      {/if}
    {/each}
  </div>
</div>

<style>
  .scrim { position: fixed; inset: 0; z-index: 230; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); }
  .doc-modal {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 231; width: min(620px, calc(100vw - 2rem)); height: min(600px, calc(100vh - 4rem));
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

  .doc-body { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; font-size: 0.85rem; color: var(--text-2); line-height: 1.6; }
  .doc-body :global(h3) { font-size: 1.05rem; color: var(--text-1); margin: 0 0 0.75rem; }
  .doc-body :global(h4) { font-size: 0.92rem; color: var(--text-1); margin: 1.1rem 0 0.5rem; }
  .doc-body :global(h5) { font-size: 0.85rem; color: var(--text-1); margin: 0.9rem 0 0.4rem; }
  .doc-body :global(p) { margin: 0 0 0.75rem; }
  .doc-body :global(ul) { margin: 0 0 0.75rem 1.1rem; display: flex; flex-direction: column; gap: 0.3rem; }
  .doc-body :global(a) { color: var(--accent); text-decoration: none; }
  .doc-body :global(a:hover) { text-decoration: underline; }
  .doc-body :global(code) {
    background: var(--surface-2); border: 1px solid var(--border); border-radius: 4px;
    padding: 0.1rem 0.3rem; font-family: 'SF Mono', Consolas, monospace; font-size: 0.82em;
  }
  .doc-body :global(pre) {
    background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px;
    padding: 0.75rem 0.9rem; margin: 0 0 0.75rem; overflow-x: auto;
    font-family: 'SF Mono', Consolas, monospace; font-size: 0.76em; line-height: 1.5;
    white-space: pre; color: var(--text-1);
  }

  @media (max-width: 640px) {
    .doc-modal {
      top: 0; left: 0; transform: none;
      width: 100vw; height: 100vh; height: 100dvh;
      border-radius: 0; border: none;
    }
  }
</style>
