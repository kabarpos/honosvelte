<script lang="ts">
  import { Link } from "@inertiajs/svelte";
  import Spinner from "./Spinner.svelte";
  import type { Snippet } from "svelte";

  type Variant = "primary" | "secondary" | "ghost" | "danger";
  type Size = "sm" | "md" | "lg";

  let {
    variant = "primary",
    size = "md",
    href = undefined,
    type = "submit",
    disabled = false,
    loading = false,
    fullWidth = false,
    class: className = "",
    children,
    ...rest
  }: {
    variant?: Variant;
    size?: Size;
    href?: string;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    class?: string;
    children: Snippet;
    [key: string]: unknown;
  } = $props();

  const base =
    "inline-flex items-center justify-center gap-1.5 font-semibold text-sm cursor-pointer transition-colors select-none disabled:opacity-60 disabled:cursor-not-allowed";
  const variants: Record<Variant, string> = {
    primary:
      "border border-primary rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover hover:border-primary-hover hover:no-underline",
    secondary:
      "border border-border rounded-lg bg-surface text-text hover:bg-primary-soft hover:no-underline",
    ghost:
      "border border-transparent rounded-lg bg-transparent text-text hover:bg-primary-soft hover:no-underline",
    danger:
      "border border-danger rounded-lg bg-danger text-destructive-foreground hover:opacity-90 hover:no-underline",
  };
  const sizes: Record<Size, string> = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5",
    lg: "px-5 py-3 text-base",
  };

  const cls = $derived(
    `${base} ${variants[variant]} ${sizes[size]}${fullWidth ? " w-full" : ""} ${className}`,
  );
</script>

{#if href}
  <Link {href} class={cls} {...rest}>
    {#if loading}<Spinner />{/if}
    {@render children()}
  </Link>
{:else}
  <button {type} class={cls} disabled={disabled || loading} {...rest}>
    {#if loading}<Spinner />{/if}
    {@render children()}
  </button>
{/if}
