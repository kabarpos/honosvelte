<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    description = undefined,
    icon,
    action,
    class: className = "",
  }: {
    title: string;
    description?: string;
    icon?: Snippet;
    action?: Snippet;
    class?: string;
  } = $props();
</script>

<div
  class={`flex flex-col items-center justify-center text-center gap-3 py-12 px-6 ${className}`}
>
  {#if icon}
    <div
      class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-soft text-primary"
    >
      {@render icon()}
    </div>
  {/if}
  <h3 class="m-0 text-base font-semibold text-text">{title}</h3>
  {#if description}
    <p class="m-0 max-w-sm text-sm text-muted">{description}</p>
  {/if}
  {#if action}
    <div class="mt-2">
      {@render action()}
    </div>
  {/if}
</div>
