<script lang="ts">
  type Option = { value: string; label: string; disabled?: boolean };

  let {
    value = $bindable<string>(),
    options,
    placeholder = undefined,
    disabled = false,
    error = false,
    id = undefined,
    name = undefined,
    class: className = "",
    ...rest
  }: {
    value?: string;
    options: Option[];
    placeholder?: string;
    disabled?: boolean;
    error?: boolean;
    id?: string;
    name?: string;
    class?: string;
    [key: string]: unknown;
  } = $props();

  const base =
    "w-full appearance-none px-3 py-2.5 pr-9 border border-border rounded-lg bg-bg text-text text-[0.95rem] focus:outline-2 focus:outline-primary focus:-outline-offset-1 focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer";
  const cls = $derived(
    `${base}${error ? " border-danger focus:border-danger focus:outline-danger" : ""} ${className}`,
  );
</script>

<div class="relative inline-block w-full">
  <select {id} {name} class={cls} bind:value {disabled} {...rest}>
    {#if placeholder}
      <option value="" disabled selected={!value}>{placeholder}</option>
    {/if}
    {#each options as opt (opt.value)}
      <option value={opt.value} disabled={opt.disabled}>{opt.label}</option>
    {/each}
  </select>
  <span
    class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  </span>
</div>
