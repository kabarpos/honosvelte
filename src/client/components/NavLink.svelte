<script lang="ts">
  import { Link, usePage } from "@inertiajs/svelte";
  import type { Snippet } from "svelte";
  import type { SharedPageProps } from "../../shared/types";

  let {
    href,
    match,
    activeClass = "text-primary font-semibold bg-primary-soft",
    class: className = "",
    children,
  }: {
    href: string;
    match?: (path: string) => boolean;
    activeClass?: string;
    class?: string;
    children: Snippet;
  } = $props();

  const page = usePage<SharedPageProps>();
  const currentPath = $derived((page.url ?? "").split("?")[0] ?? "");
  const active = $derived(
    match
      ? match(currentPath)
      : currentPath === href || currentPath.startsWith(href + "/"),
  );
</script>

<Link
  href={href}
  class={`${className}${active ? ` ${activeClass}` : ""}`}
  aria-current={active ? "page" : undefined}
>
  {@render children()}
</Link>
