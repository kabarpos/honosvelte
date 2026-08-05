<script lang="ts">
  import { Link } from "@inertiajs/svelte";

  type Crumb = { label: string; href?: string };

  let {
    items,
    class: className = "",
  }: {
    items: Crumb[];
    class?: string;
  } = $props();
</script>

<nav
  class={`flex items-center gap-1.5 text-sm text-muted ${className}`}
  aria-label="Breadcrumb"
>
  <ol class="m-0 p-0 list-none flex items-center gap-1.5 flex-wrap">
    {#each items as item, i (item.label + i)}
      <li class="flex items-center gap-1.5">
        {#if item.href && i < items.length - 1}
          <Link
            href={item.href}
            class="text-muted hover:text-text transition-colors hover:no-underline"
          >
            {item.label}
          </Link>
        {:else}
          <span class="text-text font-medium" aria-current="page">
            {item.label}
          </span>
        {/if}
      </li>
      {#if i < items.length - 1}
        <li class="text-muted select-none" aria-hidden="true">/</li>
      {/if}
    {/each}
  </ol>
</nav>
