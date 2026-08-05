<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    bordered = false,
    compact = false,
    class: className = "",
    children,
  }: {
    bordered?: boolean;
    compact?: boolean;
    class?: string;
    children: Snippet;
  } = $props();

  const cls = $derived(
    `w-full text-left text-sm border-collapse ${bordered ? "border border-border" : ""} ${compact ? "text-xs" : ""} ${className}`,
  );
</script>

<div class="w-full overflow-x-auto">
  <table class={cls}>
    {@render children()}
  </table>
</div>
