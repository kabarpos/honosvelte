<script lang="ts">
  let {
    name,
    src = undefined,
    size = "md",
    class: className = "",
  }: { name: string; src?: string; size?: "sm" | "md" | "lg"; class?: string } =
    $props();

  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-11 h-11 text-sm",
    lg: "w-16 h-16 text-lg",
  };

  function initials(n: string): string {
    return (
      n
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? "")
        .join("") || "?"
    );
  }
</script>

{#if src}
  <img
    class={`inline-flex items-center justify-center rounded-full object-cover bg-primary font-bold shrink-0 ${sizes[size]} ${className}`}
    {src}
    alt=""
  />
{:else}
  <span
    class={`inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold tracking-tight shrink-0 ${sizes[size]} ${className}`}
    aria-hidden="true"
  >
    {initials(name)}
  </span>
{/if}
