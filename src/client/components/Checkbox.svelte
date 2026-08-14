<script lang="ts">
  let {
    checked = $bindable(false),
    label = undefined,
    description = undefined,
    disabled = false,
    value = undefined,
    name = undefined,
    id = undefined,
    class: className = "",
  }: {
    checked?: boolean;
    label?: string;
    description?: string;
    disabled?: boolean;
    value?: string;
    name?: string;
    id?: string;
    class?: string;
  } = $props();
</script>

<label
  class={`inline-flex ${description ? "items-start" : "items-center"} gap-2 select-none ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${className}`}
>
  <input
    type="checkbox"
    class="peer sr-only"
    bind:checked
    {disabled}
    {value}
    {name}
    {id}
  />
  <span
    class={`inline-flex items-center justify-center w-5 h-5 ${description ? "mt-0.5" : ""} rounded border border-border bg-bg text-primary-foreground transition-colors peer-checked:bg-primary peer-checked:border-primary peer-focus-visible:outline-2 peer-focus-visible:outline-primary peer-focus-visible:outline-offset-2`}
    aria-hidden="true"
  >
    {#if checked}
      <svg
        class="w-3.5 h-3.5"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M5 10.5l3.5 3.5 6.5-7" />
      </svg>
    {/if}
  </span>
  <span class="flex flex-col min-w-0">
    {#if label}
      <span class="text-sm text-text select-none leading-tight">{label}</span>
    {/if}
    {#if description}
      <span class="text-xs text-muted select-none leading-tight">{description}</span>
    {/if}
  </span>
</label>
