<script lang="ts">
  let {
    checked = false,
    onChange,
    ariaLabel,
  }: { checked?: boolean; onChange: (checked: boolean) => void; ariaLabel?: string } = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={ariaLabel}
  class="toggle"
  class:on={checked}
  onclick={() => onChange(!checked)}
>
  <span class="knob"></span>
</button>

<style>
  .toggle {
    position: relative;
    width: 2.25rem;
    height: 1.25rem;
    border-radius: 999px;
    border: none;
    background: var(--border);
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
    transition: background 0.15s;
  }
  .toggle.on {
    background: var(--accent);
  }
  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: transform 0.15s;
  }
  .toggle.on .knob {
    transform: translateX(1rem);
  }
</style>
