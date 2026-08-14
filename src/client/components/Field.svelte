<script lang="ts">
  let {
    id,
    label,
    error,
    hint = undefined,
    children,
  }: {
    id: string
    label: string
    error?: unknown
    hint?: string
    children: import('svelte').Snippet<[{ errorId?: string; hintId?: string; hasError: boolean }]>
  } = $props()
</script>

<div class="mb-4">
  <label for={id} class="block text-sm font-semibold mb-1.5">{label}</label>
  {#if hint && !error}
    <p id={`${id}-hint`} class="text-xs text-muted mt-1">{hint}</p>
  {/if}
  <!-- UX-03: the caller's input wires aria-invalid + aria-describedby to
       these ids via the snippet context ({ errorId, hintId, hasError }). -->
  {@render children({
    errorId: error ? `${id}-error` : undefined,
    hintId: hint && !error ? `${id}-hint` : undefined,
    hasError: Boolean(error),
  })}
  {#if error}
    <p id={`${id}-error`} class="text-danger text-xs mt-1.5" role="alert">{String(error)}</p>
  {/if}
</div>
