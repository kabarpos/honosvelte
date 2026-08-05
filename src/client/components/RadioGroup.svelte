<script lang="ts">
  type Option = { value: string; label: string; disabled?: boolean };

  let {
    value = $bindable<string | null>(null),
    options = [],
    name,
    disabled = false,
    class: className = "",
  }: {
    value?: string | null;
    options?: Option[];
    name?: string;
    disabled?: boolean;
    class?: string;
  } = $props();
</script>

<div class={`flex flex-col gap-2 ${className}`} role="radiogroup">
  {#each options as opt (opt.value)}
    {@const isChecked = value === opt.value}
    <label
      class={`inline-flex items-center gap-2 select-none ${opt.disabled || disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <input
        type="radio"
        class="peer sr-only"
        {name}
        value={opt.value}
        checked={isChecked}
        disabled={opt.disabled || disabled}
        onchange={() => (value = opt.value)}
      />
      <span
        class="inline-flex items-center justify-center w-5 h-5 rounded-full border border-border bg-bg transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-primary peer-focus-visible:outline-offset-2"
      >
        {#if isChecked}
          <span class="w-2.5 h-2.5 rounded-full bg-primary-foreground"></span>
        {/if}
      </span>
      <span class="text-sm text-text">{opt.label}</span>
    </label>
  {/each}
</div>
