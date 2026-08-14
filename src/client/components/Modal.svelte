<script lang="ts">
  import type { Snippet } from "svelte";

  let modalCounter = 0;

  let {
    open = $bindable(false),
    title = undefined,
    description = undefined,
    closeOnBackdrop = true,
    closeOnEscape = true,
    size = "md",
    class: className = "",
    children,
    footer,
  }: {
    open?: boolean;
    title?: string;
    /** Supplementary text wired to aria-describedby (UX-01). */
    description?: string;
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

  const dialogId = `modal-${++modalCounter}`;
  let dialogRef = $state<HTMLDivElement | null>(null);

  function close() {
    open = false;
  }

  /** All focusable descendants, in DOM order (visibility-filtered). */
  function getFocusable(container: HTMLElement): HTMLElement[] {
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  // UX-01: on open → remember the trigger and move focus into the dialog;
  // trap Tab/Shift+Tab; Escape closes; on close → restore focus to trigger.
  $effect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = dialogRef;
    if (!dialog) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!closeOnEscape) return;
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = getFocusable(dialog);
      if (focusables.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      const inside = dialog.contains(active);
      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };

    // Focus the dialog after the DOM settles (bind:this may land this tick).
    const raf = requestAnimationFrame(() => dialog.focus());
    document.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      trigger?.focus?.();
    };
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
      bind:this={dialogRef}
      class={`w-full ${sizes[size]} max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-card shadow-card animate-[menu-in_140ms_ease] ${className}`}
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-labelledby={title ? `${dialogId}-title` : undefined}
      aria-label={title ? undefined : "Dialog"}
      aria-describedby={description ? `${dialogId}-desc` : undefined}
      onclick={(e) => e.stopPropagation()}
    >
      {#if title}
        <div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <h2 id={`${dialogId}-title`} class="m-0 text-base font-semibold text-text">
            {title}
          </h2>
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
      {#if description}
        <p id={`${dialogId}-desc`} class="m-0 px-5 pt-4 text-xs text-muted">
          {description}
        </p>
      {/if}
      <div class="px-5 py-4 text-sm text-text">
        {@render children()}
      </div>
      {#if footer}
        <div class="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
