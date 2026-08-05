<script lang="ts">
  let {
    checked = $bindable(false),
    label = undefined,
    disabled = false,
    id = undefined,
    class: className = "",
  }: {
    checked?: boolean;
    label?: string;
    disabled?: boolean;
    id?: string;
    class?: string;
  } = $props();

  const track = $derived(
    `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${checked ? "bg-primary border-primary" : "bg-bg border-border"} ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`,
  );
  const knob = $derived(
    `inline-block h-4 w-4 rounded-full bg-primary-foreground shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`,
  );
</script>

<label class={`inline-flex items-center gap-2 select-none ${className}`}>
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-labelledby={label ? id : undefined}
    {disabled}
    onclick={() => (checked = !checked)}
    class={track}
  >
    <span class={knob}></span>
  </button>
  {#if label}
    <span id={id} class="text-sm text-text select-none">{label}</span>
  {/if}
</label>
