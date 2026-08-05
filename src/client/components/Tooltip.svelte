<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    text,
    position = "top",
    trigger,
    class: className = "",
  }: {
    text: string;
    position?: "top" | "bottom" | "left" | "right";
    trigger: Snippet;
    class?: string;
  } = $props();

  let show = $state(false);

  const pos = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  class={`relative inline-flex ${className}`}
  role="group"
  onmouseenter={() => (show = true)}
  onmouseleave={() => (show = false)}
  onfocusin={() => (show = true)}
  onfocusout={() => (show = false)}
>
  {@render trigger()}
  {#if show}
    <span
      class={`absolute z-50 px-2 py-1 text-xs font-medium whitespace-nowrap rounded-md bg-text text-bg shadow-card pointer-events-none animate-[fade-in_100ms_ease] ${pos[position]}`}
      role="tooltip"
    >
      {text}
    </span>
  {/if}
</span>
