<script lang="ts">
  let {
    value = 0,
    max = 100,
    indeterminate = false,
    variant = "primary",
    label = undefined,
    class: className = "",
  }: {
    value?: number;
    max?: number;
    indeterminate?: boolean;
    variant?: "primary" | "success" | "danger";
    label?: string;
    class?: string;
  } = $props();

  const pct = $derived(Math.min(100, Math.max(0, (value / max) * 100)));
  const tones: Record<string, string> = {
    primary: "bg-primary",
    success: "bg-success-fg",
    danger: "bg-danger",
  };
</script>

<div
  class={`w-full h-2 rounded-full bg-border overflow-hidden ${className}`}
  role="progressbar"
  aria-valuemin="0"
  aria-valuemax={max}
  aria-valuenow={indeterminate ? undefined : value}
  aria-label={label}
>
  {#if indeterminate}
    <div
      class={`h-full w-full rounded-full ${tones[variant]} animate-pulse`}
    ></div>
  {:else}
    <div
      class={`h-full rounded-full ${tones[variant]} transition-[width_200ms_ease]`}
      style={`width:${pct}%`}
    ></div>
  {/if}
</div>
