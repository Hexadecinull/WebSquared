<script lang="ts">
  let { src }: { src: string } = $props();

  let frame: HTMLIFrameElement | undefined = $state();
  let loading = $state(false);

  $effect(() => {
    if (!frame || !src) return;
    loading = true;
  });

  function onLoad() {
    loading = false;
  }
</script>

<div class="frame-wrap">
  {#if loading}
    <div class="loader" aria-label="Loading...">
      <span class="spinner"></span>
    </div>
  {/if}
  <iframe
    bind:this={frame}
    {src}
    title="Proxied content"
    sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
    allow="accelerometer; camera; encrypted-media; fullscreen; geolocation; gyroscope; microphone; midi"
    referrerpolicy="no-referrer"
    onload={onLoad}
  ></iframe>
</div>

<style>
  .frame-wrap {
    position: relative;
    flex: 1;
    width: 100%;
    overflow: hidden;
  }

  iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
    background: #fff;
  }

  .loader {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    z-index: 10;
    pointer-events: none;
  }

  .spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
