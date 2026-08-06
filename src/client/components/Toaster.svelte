<script lang="ts">
  import { toasts, dismiss } from "./toast.svelte";
  import type { ToastVariant } from "./toast.svelte";

  const variants: Record<ToastVariant, string> = {
    success:
      "border-success-border bg-success-bg text-success-fg",
    error:
      "border-danger-border bg-danger-bg text-danger-fg",
    info: "border-border bg-surface text-text",
    warning:
      "border-warning-border bg-warning-bg text-warning-fg",
  };
</script>

<div
  class="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(92vw,360px)]"
  aria-live="polite"
>
  {#each toasts as t (t.id)}
    <div
      class={`flex items-start gap-3 px-4 py-3 rounded-card text-sm border shadow-card animate-[menu-in_140ms_ease] ${variants[t.variant]}`}
      role="status"
    >
      <span class="flex-1 min-w-0">{t.message}</span>
      <button
        type="button"
        class="shrink-0 opacity-70 hover:opacity-100 cursor-pointer bg-transparent border-none p-0"
        aria-label="Dismiss"
        onclick={() => dismiss(t.id)}
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
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
  {/each}
</div>
