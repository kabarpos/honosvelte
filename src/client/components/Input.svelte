<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  let {
    error = false,
    value = $bindable<string>(),
    class: className = "",
    ...rest
  }: { error?: boolean; value?: string } & HTMLInputAttributes = $props();

  const base =
    "w-full px-3 py-2.5 border border-border rounded-lg bg-bg text-text text-[0.95rem] focus:outline-2 focus:outline-primary focus:-outline-offset-1 focus:border-primary";
  const cls = $derived(
    `${base}${error ? " border-danger focus:border-danger focus:outline-danger" : ""} ${className}`,
  );
</script>

<!-- svelte-ignore a11y_autofocus -->
<input class={cls} bind:value={value} {...rest} />
