<script lang="ts">
  import { scale } from 'svelte/transition';
  import { onMount, untrack } from 'svelte';
  import { hexToHsv, hsvToHex, isValidHex, normalizeHex } from '../lib/color';

  let { value, onChange, onClose }: { value: string; onChange: (hex: string) => void; onClose: () => void } = $props();

  const initial = untrack(() => hexToHsv(value));
  let h = $state(initial.h);
  let s = $state(initial.s);
  let v = $state(initial.v);
  let hexText = $state(untrack(() => value.replace('#', '')));

  let squareEl = $state<HTMLDivElement>();
  let hueEl = $state<HTMLDivElement>();
  let pickerEl = $state<HTMLDivElement>();

  // A document-level listener is far more robust than a full-screen scrim
  // here: it doesn't depend on z-index or on some ancestor's transform
  // accidentally re-scoping position:fixed, it just checks whether the
  // interaction actually landed inside the popover.
  onMount(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (pickerEl && !pickerEl.contains(e.target as Node)) onClose();
    }
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  });

  function commit() {
    const hex = hsvToHex(h, s, v);
    hexText = hex.replace('#', '');
    onChange(hex);
  }

  function updateFromSquare(clientX: number, clientY: number) {
    if (!squareEl) return;
    const rect = squareEl.getBoundingClientRect();
    s = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    v = 1 - Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
    commit();
  }

  function updateFromHue(clientX: number) {
    if (!hueEl) return;
    const rect = hueEl.getBoundingClientRect();
    h = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1) * 360;
    commit();
  }

  function onSquarePointerDown(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updateFromSquare(e.clientX, e.clientY);
  }
  function onSquarePointerMove(e: PointerEvent) {
    if (e.buttons !== 1) return;
    updateFromSquare(e.clientX, e.clientY);
  }
  function onHuePointerDown(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updateFromHue(e.clientX);
  }
  function onHuePointerMove(e: PointerEvent) {
    if (e.buttons !== 1) return;
    updateFromHue(e.clientX);
  }

  function onHexInput(e: Event) {
    const raw = (e.currentTarget as HTMLInputElement).value;
    hexText = raw;
    if (!isValidHex(raw)) return;
    const normalized = normalizeHex(raw);
    const hsv = hexToHsv(normalized);
    h = hsv.h; s = hsv.s; v = hsv.v;
    onChange(normalized);
  }

  function usePreset(preset: string) {
    const hsv = hexToHsv(preset);
    h = hsv.h; s = hsv.s; v = hsv.v;
    hexText = preset.replace('#', '');
    onChange(preset);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  const PRESETS = ['#4f8ef7', '#f7484f', '#f7a24f', '#f7d64f', '#4ff77e', '#4fd6f7', '#a04ff7', '#f74fbf'];
</script>

<svelte:window onkeydown={onKeydown} />

<div class="picker" bind:this={pickerEl} role="dialog" aria-label="Choose accent color" transition:scale={{ duration: 120, start: 0.95 }}>
  <div
    class="sv-square"
    bind:this={squareEl}
    style="--hue: {h}"
    onpointerdown={onSquarePointerDown}
    onpointermove={onSquarePointerMove}
    role="slider"
    aria-label="Saturation and brightness"
    aria-valuenow={Math.round(s * 100)}
    tabindex="0"
  >
    <div class="sv-thumb" style="left: {s * 100}%; top: {(1 - v) * 100}%;"></div>
  </div>

  <div
    class="hue-slider"
    bind:this={hueEl}
    onpointerdown={onHuePointerDown}
    onpointermove={onHuePointerMove}
    role="slider"
    aria-label="Hue"
    aria-valuenow={Math.round(h)}
    tabindex="0"
  >
    <div class="hue-thumb" style="left: {(h / 360) * 100}%;"></div>
  </div>

  <div class="hex-row">
    <span class="hash">#</span>
    <input type="text" value={hexText} oninput={onHexInput} maxlength="7" spellcheck="false" aria-label="Hex color" />
    <div class="swatch" style="background: {hsvToHex(h, s, v)}" aria-hidden="true"></div>
  </div>

  <div class="presets">
    {#each PRESETS as preset (preset)}
      <button class="preset-swatch" style="background: {preset}" onclick={() => usePreset(preset)} aria-label={`Use ${preset}`}></button>
    {/each}
  </div>
</div>

<style>
  .picker {
    position: absolute; z-index: 241; top: calc(100% + 0.5rem); right: 0;
    width: 220px; max-width: calc(100vw - 2rem); background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 12px; padding: 0.75rem; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
    display: flex; flex-direction: column; gap: 0.65rem;
  }

  .sv-square {
    position: relative; width: 100%; height: 130px; border-radius: 8px; cursor: crosshair;
    background:
      linear-gradient(to top, #000, transparent),
      linear-gradient(to right, #fff, transparent),
      hsl(var(--hue), 100%, 50%);
    touch-action: none;
  }
  .sv-thumb {
    position: absolute; width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3);
    transform: translate(-50%, -50%); pointer-events: none;
  }

  .hue-slider {
    position: relative; width: 100%; height: 12px; border-radius: 999px; cursor: pointer;
    background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
    touch-action: none;
  }
  .hue-thumb {
    position: absolute; top: 50%; width: 16px; height: 16px; border-radius: 50%;
    background: #fff; border: 2px solid rgba(0, 0, 0, 0.2); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    transform: translate(-50%, -50%); pointer-events: none;
  }

  .hex-row { display: flex; align-items: center; gap: 0.4rem; }
  .hash { color: var(--text-2); font-size: 0.85rem; font-family: 'SF Mono', Consolas, monospace; }
  .hex-row input {
    flex: 1; min-width: 0; background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 6px; padding: 0.3rem 0.5rem; color: var(--text-1); font-size: 0.82rem;
    font-family: 'SF Mono', Consolas, monospace; text-transform: uppercase;
  }
  .hex-row input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  .swatch { width: 1.5rem; height: 1.5rem; border-radius: 6px; border: 1px solid var(--border); flex-shrink: 0; }

  .presets { display: grid; grid-template-columns: repeat(8, 1fr); gap: 0.35rem; }
  .preset-swatch {
    width: 100%; aspect-ratio: 1; border-radius: 50%; border: 1px solid rgba(0, 0, 0, 0.15);
    cursor: pointer; transition: transform 0.1s;
  }
  .preset-swatch:hover { transform: scale(1.15); }
</style>
