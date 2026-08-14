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
  let triggerRef = $state<HTMLDivElement | null>(null);
  let menuRef = $state<HTMLDivElement | null>(null);

  function choose(item: Item) {
    if (item.disabled) return;
    open = false;
    triggerRef?.focus();
    item.onclick?.();
  }

  function menuItems(): HTMLElement[] {
    return Array.from(
      menuRef?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
  }

  $effect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root && !root.contains(e.target as Node)) {
        open = false;
        triggerRef?.focus();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        open = false;
        triggerRef?.focus();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = menuItems();
        if (items.length === 0) return;
        const current = items.indexOf(document.activeElement as HTMLElement);
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const next = items[(current + delta + items.length) % items.length];
        next?.focus();
      }
    };
    // Move focus into the menu once it is rendered.
    const raf = requestAnimationFrame(() => menuItems()[0]?.focus());
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  });
</script>

<div class={`relative inline-block ${className}`} bind:this={root}>
  <div
    bind:this={triggerRef}
    class="contents"
    role="button"
    tabindex="0"
    aria-haspopup="menu"
    aria-expanded={open}
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
      bind:this={menuRef}
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
