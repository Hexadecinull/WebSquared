<script lang="ts">
  import { fromProxyPath, PREFIX } from '../../shared/url';
  import { tabs } from '../stores/tabs';
  import { history } from '../stores/history';

  let {
    tabId,
    src,
    desktopMode = false,
  }: { tabId: string; src: string; desktopMode?: boolean } = $props();

  let frame: HTMLIFrameElement | undefined = $state();
  let historyStack = $state<string[]>([]);
  let historyIndex = $state(-1);
  let loadTimeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const LOAD_TIMEOUT_MS = 20_000;

  export function goBack() {
    if (historyIndex > 0) {
      historyIndex--;
      tabs.navigate(tabId, historyStack[historyIndex]);
    }
  }

  export function goForward() {
    if (historyIndex < historyStack.length - 1) {
      historyIndex++;
      tabs.navigate(tabId, historyStack[historyIndex]);
    }
  }

  export function refresh() {
    if (frame) {
      tabs.setLoading(tabId, true);
      frame.src = frame.src;
    }
  }

  function armLoadTimeout() {
    clearTimeout(loadTimeoutHandle);
    loadTimeoutHandle = setTimeout(() => {
      tabs.setLoading(tabId, false);
    }, LOAD_TIMEOUT_MS);
  }

  // This effect must only mutate state (historyStack/historyIndex/loading) when
  // `src` genuinely represents a new navigation. Writing to tab state on every
  // run — even when nothing changed — causes the tabs store to notify
  // subscribers, which can cascade back into re-triggering this same effect.
  // The tabs store now dedupes no-op writes as a second line of defense, but
  // this guard keeps the effect itself doing the minimum necessary work.
  $effect(() => {
    if (!src) return;
    const isNewNav = historyIndex < 0 || historyStack[historyIndex] !== src;
    if (isNewNav) {
      tabs.setLoading(tabId, true);
      armLoadTimeout();
      const trimmed = historyStack.slice(0, historyIndex + 1);
      trimmed.push(src);
      historyStack = trimmed;
      historyIndex = trimmed.length - 1;
    }
    tabs.setNavState(tabId, historyIndex > 0, historyIndex < historyStack.length - 1);
  });

  function onLoad() {
    clearTimeout(loadTimeoutHandle);
    tabs.setLoading(tabId, false);
    try {
      const frameDoc = frame?.contentDocument;
      if (!frameDoc) return;
      const titleEl = frameDoc.querySelector('title');
      if (titleEl?.textContent) tabs.setTitle(tabId, titleEl.textContent);
      const faviconEl = frameDoc.querySelector<HTMLLinkElement>(
        'link[rel~="icon"], link[rel~="shortcut icon"]',
      );
      if (faviconEl?.href) tabs.setFavicon(tabId, faviconEl.href);
    } catch { /* cross-origin iframe, skip */ }

    let realUrl = src;
    try {
      const iframeSrc = frame?.contentWindow?.location?.href;
      if (iframeSrc && iframeSrc !== 'about:blank') {
        const url = new URL(iframeSrc);
        if (url.pathname.startsWith(PREFIX)) {
          realUrl = fromProxyPath(url.pathname);
        }
      }
    } catch { /* cross-origin */ }

    const title = (() => {
      try { return frame?.contentDocument?.title || new URL(realUrl).hostname; } catch { return realUrl; }
    })();
    history.push(realUrl, title);
  }
</script>

<div class="frame-wrap">
  <iframe
    bind:this={frame}
    {src}
    title="Proxied content"
    allow="camera; fullscreen; geolocation; microphone"
    referrerpolicy="no-referrer"
    onload={onLoad}
    data-desktop-mode={desktopMode}
  ></iframe>
</div>

<style>
  .frame-wrap {
    position: relative; flex: 1; width: 100%; overflow: hidden;
  }
  iframe {
    width: 100%; height: 100%; border: none; display: block; background: #fff;
  }
</style>
