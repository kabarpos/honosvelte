<script lang="ts">
  import type { Snippet } from "svelte";

  type Item = { id: string; title: string; disabled?: boolean };

  let {
    items,
    multiple = false,
    value = $bindable<string | string[] | null>(multiple ? ([] as string[]) : null),
    class: className = "",
    children,
  }: {
    items: Item[];
    multiple?: boolean;
    value?: string | string[] | null;
    class?: string;
    children: Snippet<[string]>;
  } = $props();

  function isOpen(id: string): boolean {
    return Array.isArray(value) ? value.includes(id) : value === id;
  }

  function toggle(id: string) {
    if (multiple) {
      const arr = Array.isArray(value) ? [...value] : [];
      const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(id);
      value = arr;
    } else {
      value = value === id ? null : id;
    }
  }
</script>

<div
  class={`divide-y divide-border border border-border rounded-card bg-surface ${className}`}
>
  {#each items as item (item.id)}
    {@const open = isOpen(item.id)}
    <div>
      <button
        type="button"
        class={`flex items-center justify-between gap-3 w-full px-4 py-3.5 text-left text-sm font-medium text-text cursor-pointer transition-colors hover:bg-primary-soft ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        aria-expanded={open}
        disabled={item.disabled}
        onclick={() => !item.disabled && toggle(item.id)}
      >
        <span>{item.title}</span>
        <svg
          class={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {#if open}
        <div class="px-4 pb-4 pt-0 text-sm text-muted">
          {@render children(item.id)}
        </div>
      {/if}
    </div>
  {/each}
</div>
