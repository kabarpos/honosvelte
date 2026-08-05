<script lang="ts">
  import Input from "./Input.svelte";
  import type { Snippet } from "svelte";

  let {
    id,
    label,
    error = undefined,
    hint = undefined,
    value = $bindable<string>(),
    class: className = "",
    children,
    ...rest
  }: {
    id: string;
    label: string;
    error?: string;
    hint?: string;
    value?: string;
    class?: string;
    children?: Snippet;
    [key: string]: unknown;
  } = $props();
</script>

<div class={`mb-4 ${className}`}>
  <label for={id} class="block text-sm font-semibold mb-1.5">{label}</label>
  {#if children}
    {@render children()}
  {:else}
    <Input {id} bind:value={value} error={!!error} {...rest} />
  {/if}
  {#if hint && !error}
    <p class="text-xs text-muted mt-1">{hint}</p>
  {/if}
  {#if error}
    <p class="text-danger text-xs mt-1.5" role="alert">{String(error)}</p>
  {/if}
</div>
