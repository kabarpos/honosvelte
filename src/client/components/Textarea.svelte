<script lang="ts">
  let {
    id,
    label,
    error = undefined,
    hint = undefined,
    value = $bindable<string>(),
    rows = 4,
    class: className = "",
    ...rest
  }: {
    id: string;
    label: string;
    error?: string;
    hint?: string;
    value?: string;
    rows?: number;
    class?: string;
    [key: string]: unknown;
  } = $props();

  const base =
    "w-full px-3 py-2.5 border border-border rounded-lg bg-bg text-text text-[0.95rem] focus:outline-2 focus:outline-primary focus:-outline-offset-1 focus:border-primary resize-y";
  const cls = $derived(
    `${base}${error ? " border-danger focus:border-danger focus:outline-danger" : ""} ${className}`,
  );
</script>

<div class="mb-4">
  <label for={id} class="block text-sm font-semibold mb-1.5">{label}</label>
  <textarea {id} {rows} class={cls} bind:value {...rest}></textarea>
  {#if hint && !error}
    <p class="text-xs text-muted mt-1">{hint}</p>
  {/if}
  {#if error}
    <p class="text-danger text-xs mt-1.5" role="alert">{String(error)}</p>
  {/if}
</div>
