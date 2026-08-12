<script lang="ts">
  import { Link } from '@inertiajs/svelte'

  // Branding comes from the app.* settings (PRD Modul 15): name + optional
  // light/dark logo uploads. When no logo is configured the boilerplate
  // mark + name are rendered instead.
  let {
    href,
    name = '',
    logoLight = '',
    logoDark = '',
    class: className = '',
  }: {
    href: string
    name?: string
    logoLight?: string
    logoDark?: string
    class?: string
  } = $props()

  const hasLight = $derived(logoLight.length > 0)
  const hasDark = $derived(logoDark.length > 0)
</script>

<Link
  href={href}
  class={`inline-flex items-center gap-2 font-bold text-text tracking-tight hover:no-underline ${className}`}
>
  {#if hasLight || hasDark}
    {#if hasLight}
      <img
        class={`h-8 w-auto object-contain shrink-0 ${hasDark ? 'dark:hidden' : ''}`}
        src={logoLight}
        alt={name}
      />
    {/if}
    {#if hasDark}
      <img
        class={`h-8 w-auto object-contain shrink-0 ${hasLight ? 'hidden dark:block' : ''}`}
        src={logoDark}
        alt={name}
      />
    {/if}
    {#if name}
      <span>{name}</span>
    {/if}
  {:else}
    <svg
      class="text-primary shrink-0"
      viewBox="0 0 32 32"
      width="28"
      height="28"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M17.8 5.6 8.4 18h5.2l-1.2 8.4 9.2-12h-5.2z" fill="white" />
    </svg>
    {#if name}
      <span>{name}</span>
    {/if}
  {/if}
</Link>
