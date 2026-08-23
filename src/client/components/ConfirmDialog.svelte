<script lang="ts">
  import { fade, scale } from 'svelte/transition';

  let {
    message,
    confirmLabel = 'Yes',
    cancelLabel = 'No',
    onConfirm,
    onCancel,
  }: {
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onCancel();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="scrim" onclick={onCancel} role="presentation" transition:fade={{ duration: 120 }}></div>
<div class="confirm-card" role="alertdialog" aria-modal="true" aria-label="Confirm action" transition:scale={{ duration: 140, start: 0.92 }}>
  <p>{message}</p>
  <div class="actions">
    <button class="no-btn" onclick={onCancel}>{cancelLabel}</button>
    <button class="yes-btn" onclick={onConfirm}>{confirmLabel}</button>
  </div>
</div>

<style>
  .scrim { position: fixed; inset: 0; z-index: 220; background: rgba(0, 0, 0, 0.5); }
  .confirm-card {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 221; width: min(320px, calc(100vw - 2rem));
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 12px; padding: 1.1rem; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    display: flex; flex-direction: column; gap: 1rem;
  }
  .confirm-card p { font-size: 0.85rem; color: var(--text-1); line-height: 1.5; }
  .actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
  .no-btn {
    padding: 0.4rem 0.9rem; border-radius: 7px; border: 1px solid var(--border);
    background: transparent; color: var(--text-1); font-size: 0.8rem;
    font-family: inherit; cursor: pointer;
  }
  .no-btn:hover { background: var(--surface-2); }
  .yes-btn {
    padding: 0.4rem 0.9rem; border-radius: 7px; border: none;
    background: #f85149; color: #fff; font-size: 0.8rem;
    font-family: inherit; cursor: pointer; font-weight: 600;
  }
  .yes-btn:hover { background: #e5433c; }
</style>
