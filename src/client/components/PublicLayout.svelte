<script lang="ts">
  import { Link, usePage } from '@inertiajs/svelte'
  import type { Snippet } from 'svelte'
  import Brand from './Brand.svelte'
  import Button from './Button.svelte'

  let { children }: { children: Snippet } = $props()

  const page = usePage()
  const user = $derived(page.props.auth.user)
  const settings = $derived(page.props.settings ?? {})
  const url = $derived(page.url)
  const currentPath = $derived(url?.split('?')[0] ?? '')

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/services', label: 'Services' },
    { href: '/contact', label: 'Contact' },
  ]

  // contact.email is a single string in settings (PRD Modul 15).
  const contactAny = $derived(Boolean(
    settings['contact.email'] ||
      settings['contact.address'] ||
      settings['contact.whatsapp'],
  ))

  let mobileOpen = $state(false)
  function closeMobile() {
    mobileOpen = false
  }
</script>

<div class="min-h-screen flex flex-col bg-bg text-text">
  <!-- Header -->
  <header
    class="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur backdrop-saturate-[1.8]"
  >
    <div class="mx-auto max-w-[1200px] px-5 h-16 flex items-center justify-between gap-4 max-md:px-4">
      <Brand
        href="/"
        name={settings['app.name']}
        logoLight={settings['app.logo_light']}
        logoDark={settings['app.logo_dark']}
      />

      <nav class="hidden items-center gap-1 md:flex">
        {#each navItems as item (item.href)}
          <Link
            href={item.href}
            class={`px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-primary-soft hover:no-underline${currentPath === item.href ? ' text-primary bg-primary-soft' : ' text-text'}`}
          >
            {item.label}
          </Link>
        {/each}
      </nav>

      <div class="flex items-center gap-2">
        {#if user}
          <Button href="/dashboard" variant="secondary" size="sm">Dashboard</Button>
        {:else}
          <Link
            href="/login"
            class="hidden px-3 py-2 rounded-lg text-sm font-medium text-text hover:bg-primary-soft hover:no-underline md:inline-flex"
          >
            Log in
          </Link>
          <Button href="/register" variant="primary" size="sm">Get started</Button>
        {/if}
        <button
          type="button"
          class="inline-flex items-center justify-center w-10 h-10 border border-border rounded-lg bg-surface text-text cursor-pointer md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          onclick={() => (mobileOpen = !mobileOpen)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            {#if mobileOpen}
              <path d="M18 6 6 18M6 6l12 12" />
            {:else}
              <path d="M3 6h18M3 12h18M3 18h18" />
            {/if}
          </svg>
        </button>
      </div>
    </div>

    {#if mobileOpen}
      <nav class="border-t border-border md:hidden">
        <div class="mx-auto max-w-[1200px] px-4 py-2 flex flex-col">
          {#each navItems as item (item.href)}
            <Link
              href={item.href}
              class={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-primary-soft hover:no-underline${currentPath === item.href ? ' text-primary bg-primary-soft' : ' text-text'}`}
              onclick={closeMobile}
            >
              {item.label}
            </Link>
          {/each}
          {#if !user}
            <Link href="/login" class="px-3 py-2.5 rounded-lg text-sm font-medium text-text hover:bg-primary-soft hover:no-underline" onclick={closeMobile}>
              Log in
            </Link>
          {/if}
        </div>
      </nav>
    {/if}
  </header>

  <main class="flex-1 w-full">
    {@render children()}
  </main>

  <footer class="border-t border-border px-5 py-8 max-md:px-4">
    <div class="mx-auto max-w-[1200px] flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="m-0 text-sm font-bold">{settings['app.name'] || 'Honosvelte'}</p>
          {#if settings['app.tagline']}
            <p class="mt-0.5 text-xs text-muted">{settings['app.tagline']}</p>
          {/if}
        </div>
        {#if contactAny}
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted text-xs">
            {#if settings['contact.email']}
              <a class="hover:text-text" href={`mailto:${settings['contact.email']}`}>{settings['contact.email']}</a>
            {/if}
            {#if settings['contact.address']}
              <span>{settings['contact.address']}</span>
            {/if}
          </div>
        {/if}
      </div>
      <div class="pt-4 border-t border-border text-muted text-xs flex flex-wrap items-center justify-between gap-2">
        <span>{settings['footer.copyright'] || `© ${new Date().getFullYear()} ${settings['app.name'] || 'Honosvelte'}`}</span>
        {#if settings['footer.text']}
          <span>{settings['footer.text']}</span>
        {/if}
      </div>
    </div>
  </footer>
</div>
