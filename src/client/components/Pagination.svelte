<script lang="ts">
  let {
    page = $bindable(1),
    totalPages,
    class: className = "",
  }: {
    page?: number;
    totalPages: number;
    class?: string;
  } = $props();

  const base =
    "inline-flex items-center justify-center min-w-9 h-9 px-3 rounded-lg border border-border bg-surface text-text text-sm cursor-pointer transition-colors hover:bg-primary-soft disabled:opacity-40 disabled:cursor-not-allowed";
  const active = `${base} bg-primary border-primary text-primary-foreground hover:bg-primary-hover`;

  const pages = $derived(buildPages(page, totalPages));

  function buildPages(current: number, total: number): (number | "…")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const out: (number | "…")[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    if (start > 2) out.push("…");
    for (let i = start; i <= end; i++) out.push(i);
    if (end < total - 1) out.push("…");
    out.push(total);
    return out;
  }

  function go(p: number) {
    if (p < 1 || p > totalPages || p === page) return;
    page = p;
  }
</script>

{#if totalPages > 1}
  <nav
    class={`flex items-center gap-1 ${className}`}
    aria-label="Pagination"
  >
    <button
      type="button"
      class={base}
      aria-label="Previous page"
      disabled={page <= 1}
      onclick={() => go(page - 1)}
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
        <path d="m15 18-6-6 6-6" />
      </svg>
    </button>

    {#each pages as p, i (i)}
      {#if p === "…"}
        <span class="px-2 text-muted select-none" aria-hidden="true">…</span>
      {:else}
        <button
          type="button"
          class={p === page ? active : base}
          aria-current={p === page ? "page" : undefined}
          onclick={() => go(p)}
        >
          {p}
        </button>
      {/if}
    {/each}

    <button
      type="button"
      class={base}
      aria-label="Next page"
      disabled={page >= totalPages}
      onclick={() => go(page + 1)}
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
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  </nav>
{/if}
