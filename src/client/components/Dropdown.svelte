<script lang="ts">
  import type { Snippet } from "svelte";

  type Item = {
    label: string;
    href?: string;
    onclick?: () => void;
    disabled?: boolean;
    danger?: boolean;
  };

  let {
    items = [],
    align = "left",
    trigger,
    class: className = "",
  }: {
    items?: Item[];
    align?: "left" | "right";
    trigger: Snippet;
    class?: string;
  } = $props();

  let open = $state(false);
  let root = $state<HTMLDivElement | null>(null);

  function choose(item: Item) {
    if (item.disabled) return;
    open = false;
    item.onclick?.();
  }

  $effect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root && !root.contains(e.target as Node)) open = false;
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (open = false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  });
</script>

<div class={`relative inline-block ${className}`} bind:this={root}>
  <div
    class="contents"
    role="button"
    tabindex="0"
    onclick={() => (open = !open)}
    onkeydown={(e) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open = !open;
      }
    }}
  >
    {@render trigger()}
  </div>

  {#if open}
    <div
      class={`absolute top-full mt-2 min-w-[180px] bg-surface border border-border rounded-card shadow-card p-1 z-40 animate-[menu-in_120ms_ease] ${align === "right" ? "right-0" : "left-0"}`}
      role="menu"
    >
      {#each items as item (item.label)}
        {#if item.href}
          <a
            href={item.href}
            role="menuitem"
            class={`flex items-center w-full px-2.5 py-2 rounded-lg text-sm text-left cursor-pointer transition-colors hover:bg-primary-soft hover:no-underline ${item.disabled ? "opacity-50 pointer-events-none" : ""} ${item.danger ? "text-danger" : "text-text"}`}
            onclick={() => (open = false)}
          >
            {item.label}
          </a>
        {:else}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            class={`flex items-center w-full px-2.5 py-2 rounded-lg text-sm text-left cursor-pointer transition-colors hover:bg-primary-soft ${item.disabled ? "opacity-50 cursor-not-allowed" : ""} ${item.danger ? "text-danger" : "text-text"}`}
            onclick={() => choose(item)}
          >
            {item.label}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>
