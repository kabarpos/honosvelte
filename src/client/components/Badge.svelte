<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "primary" | "amber" | "neutral";

  let {
    variant = "primary",
    class: className = "",
    children,
  }: { variant?: Variant; class?: string; children: Snippet } = $props();

  const variants: Record<Variant, string> = {
    primary: "bg-primary-soft text-primary",
    amber: "bg-warning-bg text-warning-fg",
    neutral: "bg-bg text-muted border border-border",
  };
</script>

<span
  class={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${variants[variant]} ${className}`}
>
  {@render children()}
</span>
