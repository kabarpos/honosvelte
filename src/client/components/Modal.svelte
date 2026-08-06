<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    open = $bindable(false),
    title = undefined,
    closeOnBackdrop = true,
    closeOnEscape = true,
    size = "md",
    class: className = "",
    children,
    footer,
  }: {
    open?: boolean;
    title?: string;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    size?: "sm" | "md" | "lg" | "xl";
    class?: string;
    children: Snippet;
    footer?: Snippet;
  } = $props();

  const sizes = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
  };

  function close() {
    open = false;
  }

  $effect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay animate-[fade-in_120ms_ease]"
    role="presentation"
    onclick={closeOnBackdrop ? close : undefined}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
    <div
      class={`w-full ${sizes[size]} max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-card shadow-card animate-[menu-in_140ms_ease] ${className}`}
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label={title}
      onclick={(e) => e.stopPropagation()}
    >
      {#if title}
        <div
          class="flex items-center justify-between gap-3 px-5 py-4 border-b border-border"
        >
          <h2 class="m-0 text-base font-semibold text-text">{title}</h2>
          <button
            type="button"
            class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted cursor-pointer transition-colors hover:bg-primary-soft hover:text-text"
            aria-label="Close"
            onclick={close}
          >
            <svg
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
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      {/if}
      <div class="px-5 py-4 text-sm text-text">
        {@render children()}
      </div>
      {#if footer}
        <div
          class="flex items-center justify-end gap-2 px-5 py-4 border-t border-border"
        >
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
