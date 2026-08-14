<script lang="ts">
  import type { Snippet } from "svelte";

  type Tab = { value: string; label: string; disabled?: boolean };

  let tabCounter = 0;

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

  const listId = `tabs-${++tabCounter}`;
  let listRef = $state<HTMLDivElement | null>(null);

  const enabledIndexes = $derived(
    tabs.map((t, i) => (t.disabled ? -1 : i)).filter((i) => i >= 0),
  );
  const activeIndex = $derived(
    Math.max(0, tabs.findIndex((t) => t.value === value)),
  );

  function tabEl(i: number): HTMLButtonElement | null {
    return (
      listRef?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[i] ?? null
    );
  }

  function selectAndFocus(i: number) {
    const tab = tabs[i];
    if (!tab || tab.disabled) return;
    value = tab.value;
    tabEl(i)?.focus();
  }

  /** WAI-ARIA tabs pattern (automatic activation): Arrow/Home/End on the
   *  tablist move selection AND focus; only the active tab is in tab order. */
  function onKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        if (enabledIndexes.length === 0) return;
        {
          const current = enabledIndexes.findIndex((i) => i >= activeIndex);
          const base = current === -1 ? -1 : current;
          const next =
            enabledIndexes[(base + 1) % enabledIndexes.length] ?? -1;
          if (next >= 0) selectAndFocus(next);
        }
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        if (enabledIndexes.length === 0) return;
        {
          const current = enabledIndexes.findIndex((i) => i >= activeIndex);
          const base = current === -1 ? 0 : current;
          const next =
            enabledIndexes[(base - 1 + enabledIndexes.length) % enabledIndexes.length] ??
            -1;
          if (next >= 0) selectAndFocus(next);
        }
        break;
      case "Home":
        e.preventDefault();
        if (enabledIndexes.length > 0) selectAndFocus(enabledIndexes[0] ?? -1);
        break;
      case "End":
        e.preventDefault();
        if (enabledIndexes.length > 0)
          selectAndFocus(enabledIndexes[enabledIndexes.length - 1] ?? -1);
        break;
    }
  }
</script>

<div class={className}>
  <div
    bind:this={listRef}
    id={listId}
    class="flex items-center gap-1 border-b border-border"
    role="tablist"
    tabindex="-1"
    onkeydown={onKeydown}
  >
    {#each tabs as tab, i (tab.value)}
      {@const active = tab.value === value}
      <button
        type="button"
        role="tab"
        id={`${listId}-tab-${i}`}
        aria-selected={active}
        aria-controls={`${listId}-panel`}
        tabindex={active ? 0 : -1}
        disabled={tab.disabled}
        class={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${tab.disabled ? "opacity-50 cursor-not-allowed" : ""} ${active ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"}`}
        onclick={() => !tab.disabled && (value = tab.value)}
      >
        {tab.label}
      </button>
    {/each}
  </div>
  <div
    id={`${listId}-panel`}
    class="pt-4"
    role="tabpanel"
    aria-labelledby={`${listId}-tab-${activeIndex}`}
  >
    {@render children?.(value)}
  </div>
</div>
