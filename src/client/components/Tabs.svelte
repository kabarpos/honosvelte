<script lang="ts">
  import type { Snippet } from "svelte";

  type Tab = { value: string; label: string; disabled?: boolean };

  let {
    tabs,
    value = $bindable<string>(tabs[0]?.value ?? ""),
    class: className = "",
    children,
  }: {
    tabs: Tab[];
    value?: string;
    class?: string;
    children?: Snippet<[string]>;
  } = $props();
</script>

<div class={className}>
  <div
    class="flex items-center gap-1 border-b border-border"
    role="tablist"
  >
    {#each tabs as tab (tab.value)}
      {@const active = tab.value === value}
      <button
        type="button"
        role="tab"
        aria-selected={active}
        disabled={tab.disabled}
        class={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${tab.disabled ? "opacity-50 cursor-not-allowed" : ""} ${active ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"}`}
        onclick={() => !tab.disabled && (value = tab.value)}
      >
        {tab.label}
      </button>
    {/each}
  </div>
  <div class="pt-4" role="tabpanel">
    {@render children?.(value)}
  </div>
</div>
