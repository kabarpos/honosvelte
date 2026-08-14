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

  let inputRef = $state<HTMLInputElement | null>(null);

  const describedBy = $derived(
    [error ? `${id}-error` : undefined, hint && !error ? `${id}-hint` : undefined]
      .filter(Boolean)
      .join(" ") || undefined,
  );

  // UX-03: when a validation error appears, move focus to this field — but
  // only if no invalid field already has focus, so the FIRST invalid field
  // in DOM order wins (top-down effect order).
  $effect(() => {
    const hasError = Boolean(error);
    if (!hasError) return;
    const active = document.activeElement as HTMLElement | null;
    if (active?.matches?.('[aria-invalid="true"]')) return;
    const raf = requestAnimationFrame(() => document.getElementById(id)?.focus());
    return () => cancelAnimationFrame(raf);
  });
</script>

<div class={`mb-4 ${className}`}>
  <label for={id} class="block text-sm font-semibold mb-1.5">{label}</label>
  {#if children}
    {@render children()}
  {:else}
    <Input
      {id}
      bind:value={value}
      error={!!error}
      aria-invalid={error ? "true" : undefined}
      aria-describedby={describedBy}
      {...rest}
    />
  {/if}
  {#if hint && !error}
    <p id={`${id}-hint`} class="text-xs text-muted mt-1">{hint}</p>
  {/if}
  {#if error}
    <p id={`${id}-error`} class="text-danger text-xs mt-1.5" role="alert">{String(error)}</p>
  {/if}
</div>
