<script lang="ts">
  import { fromProxyPath, PREFIX } from '../../shared/url';
  import { tabs } from '../stores/tabs';
  import { history } from '../stores/history';
  import { settings } from '../stores/settings';

  let {
    tabId,
    src,
    desktopMode = false,
    isPrivate = false,
  }: { tabId: string; src: string; desktopMode?: boolean; isPrivate?: boolean } = $props();

  let frame: HTMLIFrameElement | undefined = $state();
  let historyStack = $state<string[]>([]);
  let historyIndex = $state(-1);
  let loadTimeoutHandle: ReturnType<typeof setTimeout> | undefined;

  // A conservative, opt-in allowlist: no payment (fraud risk if a proxied
  // page phishes for card details), no usb/serial/hid/bluetooth (direct
  // hardware access). Even this reduced set can still be misused by a
  // malicious page, so it's off by default (see Settings > Browsing).
  const PERMISSIONS_ALLOW = 'camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen; autoplay; picture-in-picture';
  let iframeAllow = $derived($settings.sitePermissions ? PERMISSIONS_ALLOW : '');

  // Plain variable, not $state, so it doesn't trigger the effect below when it changes; it only guards against re-processing a `src` already handled.
  let lastProcessedSrc = '';

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
      armLoadTimeout();
      frame.src = frame.src;
    }
  }

  export function getIframe(): HTMLIFrameElement | undefined {
    return frame;
  }

  function armLoadTimeout() {
    clearTimeout(loadTimeoutHandle);
    loadTimeoutHandle = setTimeout(() => {
      tabs.setLoading(tabId, false);
    }, LOAD_TIMEOUT_MS);
  }

  $effect(() => {
    if (!src || src === lastProcessedSrc) return;
    lastProcessedSrc = src;

    tabs.setLoading(tabId, true);
    armLoadTimeout();

    const trimmed = historyStack.slice(0, historyIndex + 1);
    trimmed.push(src);
    historyStack = trimmed;
    historyIndex = trimmed.length - 1;

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
    // Gated here, the one place every load funnels through, so a private tab or history-off setting can never leak an entry regardless of how the page was reached.
    if (!isPrivate && $settings.saveHistory) history.push(realUrl, title);
  }
</script>

<div class="frame-wrap">
  <iframe
    bind:this={frame}
    {src}
    title="Proxied content"
    allow={iframeAllow}
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
