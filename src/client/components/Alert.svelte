<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "success" | "error" | "info" | "warning";

  let {
    variant = "info",
    class: className = "",
    children,
  }: { variant?: Variant; class?: string; children: Snippet } = $props();

  const variants: Record<Variant, string> = {
    success:
      "border-success-border bg-success-bg text-success-fg",
    error:
      "border-danger-border bg-danger-bg text-danger-fg",
    info: "border-border bg-surface text-text",
    warning:
      "border-warning-border bg-warning-bg text-warning-fg",
  };
</script>

<div
  class={`px-4 py-3 rounded-lg text-sm border ${variants[variant]} ${className}`}
  role={variant === "error" ? "alert" : "status"}
>
  {@render children()}
</div>
