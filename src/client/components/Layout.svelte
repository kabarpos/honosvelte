<script lang="ts">
  import { Link, router, usePage } from '@inertiajs/svelte'
  import type { Snippet } from 'svelte'
  import type { SharedPageProps } from '../../shared/types'
  import { can } from '../capabilities'
  import Brand from './Brand.svelte'

  let { children }: { children: Snippet } = $props()

  const page = usePage<SharedPageProps>()
  const user = $derived(page.props.auth.user)
  const flash = $derived(page.flash)
  const url = $derived(page.url)
	// App-wide settings (PRD Modul 15) drive the brand, footer and contact
	// strip — see /settings.
	const settings = $derived(page.props.settings ?? {})
	// contact.whatsapp is a JSON array of numbers (Settings repeater).
	const whatsappNumbers = $derived.by(() => {
	  const raw = settings['contact.whatsapp'] ?? ''
	  if (!raw) return []
	  try {
	    const parsed: unknown = JSON.parse(raw)
	    return Array.isArray(parsed)
	      ? parsed.filter(
	          (n): n is string => typeof n === 'string' && n.trim().length > 0,
	        )
	      : []
	  } catch {
	    return []
	  }
	})
	const contactAny = $derived(
	  Boolean(
	    settings['contact.email'] ||
	      settings['contact.address'] ||
	      whatsappNumbers.length > 0,
	  ),
	)

  type NavItem = {
    href: string
    label: string
    /** Permission slug required to see the item (super_admin sees all). */
    can?: string
    match: (path: string) => boolean
  }

  type NavGroup = {
    label: string
    items: NavItem[]
  }

  const NAV_GROUPS: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { href: '/dashboard', label: 'Dashboard', match: (p) => p === '/dashboard' || p.startsWith('/dashboard') },
      ],
    },
    {
      label: 'Content',
      items: [
        { href: '/media', label: 'Media', match: (p) => p === '/media' || p.startsWith('/media') },
      ],
    },
     {
      label: 'User Management',
      items: [
        { href: '/users', label: 'Users', can: 'users.read', match: (p) => p === '/users' || p.startsWith('/users') },
        { href: '/roles', label: 'Roles', can: 'roles.read', match: (p) => p === '/roles' || p.startsWith('/roles') },
        { href: '/permissions', label: 'Permissions', can: 'permissions.read', match: (p) => p === '/permissions' || p.startsWith('/permissions') },
      ],
    },
    {
      label: 'Messaging',
      items: [
        { href: '/whatsapp', label: 'WhatsApp', can: 'whatsapp.read', match: (p) => p === '/whatsapp' || p.startsWith('/whatsapp') },
        { href: '/email', label: 'Email', can: 'email.read', match: (p) => p === '/email' || p.startsWith('/email') },
        { href: '/notifications', label: 'Notifications', can: 'notifications.read', match: (p) => p === '/notifications' || p.startsWith('/notifications') },
        { href: '/contact/inbox', label: 'Contact', can: 'contact.read', match: (p) => p === '/contact/inbox' || p.startsWith('/contact/inbox') },
      ],
    },
       {
      label: 'Administration',
      items: [
        { href: '/billing', label: 'Billing', match: (p) => p === '/billing' || p.startsWith('/billing') },
        { href: '/settings', label: 'Settings', can: 'settings.read', match: (p) => p === '/settings' || p.startsWith('/settings') },
        { href: '/activity', label: 'Activity', can: 'activity.read', match: (p) => p === '/activity' || p.startsWith('/activity') },
      ],
    },
  ]

  type Theme = 'light' | 'dark'

  function getInitialTheme(): Theme {
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-theme')
      if (attr === 'light' || attr === 'dark') return attr
    }
    if (
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark'
    }
    return 'light'
  }

  function initials(name: string): string {
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? '')
        .join('') || '?'
    )
  }

  let theme = $state<Theme>('light')
  let sidebarOpen = $state(false)
  let menuOpen = $state(false)
  let menuRef = $state<HTMLDivElement | null>(null)
  let skipApply = $state(true)

  // Sync state from <html data-theme> before paint.
  $effect(() => {
    theme = getInitialTheme()
  })

  // Persist + apply theme whenever the toggle changes it. Skipped on
  // initial mount (DOM already correct from inline head script).
  $effect(() => {
    if (skipApply) {
      skipApply = false
      return
    }
    const el = document.documentElement
    el.setAttribute('data-theme', theme)
    el.style.backgroundColor = 'var(--background)'
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* ignore (private mode / SSR) */
    }
  })

  // Close dropdown on outside click.
  $effect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef && !menuRef.contains(e.target as Node)) menuOpen = false
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (menuOpen = false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  })

  // Close mobile sidebar on route change.
  $effect(() => {
    url // track url
    sidebarOpen = false
    menuOpen = false
  })

  const currentPath = $derived(url?.split('?')[0] ?? '')
  const groups = $derived(
    NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => !i.can || can(i.can),
      ),
    })).filter((g) => g.items.length > 0),
  )

  // Collapsible parent-child nav state. Each group (parent) starts expanded and
  // auto-opens when one of its children is the active route.
  let expanded = $state<Record<string, boolean>>({})
  function toggleGroup(label: string) {
    expanded[label] = !(expanded[label] ?? true)
  }
  const groupsView = $derived(
    groups.map((g) => ({
      ...g,
      open: (expanded[g.label] ?? true) || g.items.some((i) => i.match(currentPath)),
    })),
  )

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark'
  }

  function handleLogout() {
    menuOpen = false
    router.post('/logout')
  }
</script>

<div class="grid grid-cols-[260px_1fr] min-h-screen bg-bg max-md:grid-cols-1">
  <!-- Mobile backdrop -->
  {#if sidebarOpen}
    <div
      class="fixed inset-0 bg-overlay z-[25] animate-[fade-in_120ms_ease]"
      aria-hidden="true"
      onclick={() => (sidebarOpen = false)}
    ></div>
  {/if}

  <!-- Sidebar -->
  <aside
    class={`sticky top-0 self-start h-screen flex flex-col bg-surface border-r border-border z-30 max-md:fixed max-md:top-0 max-md:left-0 max-md:w-[280px] max-md:max-w-[85vw] max-md:-translate-x-full max-md:transition-transform max-md:shadow-card${sidebarOpen ? ' max-md:translate-x-0' : ''}`}
    aria-label="Primary"
  >
    <div
      class="flex items-center justify-between gap-2 px-5 border-b border-border h-16 shrink-0"
    >
	      <Brand
	        href={user ? '/dashboard' : '/login'}
	        name={settings['app.name']}
	        logoLight={settings['app.logo_light']}
	        logoDark={settings['app.logo_dark']}
	      />
      <button
        type="button"
        class="hidden items-center justify-center w-9 h-9 border border-border rounded-lg bg-transparent text-text cursor-pointer max-md:flex"
        aria-label="Close navigation"
        onclick={() => (sidebarOpen = false)}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
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

    <nav class="flex-1 overflow-y-auto px-3 py-4">
      {#each groupsView as group, i (group.label)}
        {#if i > 0}
          <div class="mx-3 my-2 h-px bg-border"></div>
        {/if}
        <div class="mb-1">
          <button
            type="button"
            class="flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-muted transition-colors hover:text-text hover:bg-primary-soft cursor-pointer"
            aria-expanded={group.open}
            aria-label={`Toggle ${group.label} menu`}
            onclick={() => toggleGroup(group.label)}
          >
            <span>{group.label}</span>
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              class={`transition-transform duration-150${group.open ? ' rotate-180' : ''}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {#if group.open}
            <ul class="list-none m-0 p-0 flex flex-col gap-0.5 mt-0.5">
              {#each group.items as item (item.href)}
            {@const active = item.match(currentPath)}
          <li>
            <Link
              href={item.href}
              class={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-text text-sm font-medium transition-colors hover:bg-primary-soft hover:no-underline${active ? ' bg-primary-soft text-primary font-semibold' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span
                class={`inline-flex shrink-0 ${active ? 'text-primary' : 'text-muted'}`}
              >
                {#if item.href === '/dashboard'}
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
                    <rect x="3" y="3" width="7" height="9" rx="1" />
                    <rect x="14" y="3" width="7" height="5" rx="1" />
                    <rect x="14" y="12" width="7" height="9" rx="1" />
                    <rect x="3" y="16" width="7" height="5" rx="1" />
                  </svg>
                {:else if item.href === '/profile'}
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
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                {:else if item.href === '/media'}
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
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
                  </svg>
                {:else if item.href === '/billing'}
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
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <path d="M2 10h20" />
                  </svg>
                {:else if item.href === '/users'}
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
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                {:else if item.href === '/roles'}
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
                    <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" />
                    <path d="M12 22v-9" />
                    <circle cx="12" cy="8.5" r="2" />
                  </svg>
                {:else if item.href === '/permissions'}
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
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <circle cx="12" cy="16" r="1.5" />
                  </svg>
                {:else if item.href === '/activity'}
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
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                {:else if item.href === '/settings'}
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
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                  </svg>
                {:else if item.href === '/email'}
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
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                {:else if item.href === '/whatsapp'}
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
                    <path d="M21 11.5a8.4 8.4 0 0 1-12 7.6L3 21l1.9-6a8.4 8.4 0 1 1 16-3.5Z" />
                    <path d="M8.5 9.5c0 4 2.5 6.5 6.5 6.5" />
                  </svg>
                {:else if item.href === '/contact/inbox'}
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
                    <path d="M4 4h16v14H7l-3 3V4Z" />
                    <path d="M8 9h8M8 13h5" />
                  </svg>
                {:else if item.href === '/notifications'}
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
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                  </svg>
                {/if}
              </span>
              <span>{item.label}</span>
            </Link>
          </li>
          {/each}
            </ul>
          {/if}
        </div>
      {/each}
    </nav>

    <!-- <div class="p-3 border-t border-border">
	      <div class="p-3.5 rounded-card bg-bg border border-border">
	        <p class="m-0 text-sm font-bold">
	          {settings['app.name'] || 'Honosvelte'}
	        </p>
	        {#if settings['app.tagline']}
	          <p class="mt-0.5 text-xs text-muted">{settings['app.tagline']}</p>
	        {/if}
	      </div>
    </div> -->
  </aside>

  <!-- Main column -->
  <div class="flex flex-col min-w-0">
    <header
      class="sticky top-0 z-20 flex items-center justify-between gap-4 px-5 py-2.5 bg-surface/88 backdrop-saturate-[1.8] backdrop-blur border-b border-border h-16 max-md:px-4"
    >
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <button
          type="button"
          class="hidden items-center justify-center w-10 h-10 border border-border rounded-lg bg-surface text-text cursor-pointer shrink-0 max-md:flex"
          aria-label="Open navigation"
          aria-expanded={sidebarOpen}
          onclick={() => (sidebarOpen = !sidebarOpen)}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <label
          class="relative flex items-center w-full max-w-[360px] h-10 px-2.5 border border-border rounded-lg bg-bg text-muted transition-colors focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--primary-soft)] max-[960px]:hidden"
        >
          <span class="inline-flex text-muted shrink-0">
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
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search…"
            aria-label="Search"
            class="flex-1 min-w-0 border-none outline-none bg-transparent text-text text-sm px-1 placeholder:text-muted"
          />
          <kbd
            class="font-mono text-xs px-1 py-0.5 border border-border rounded text-muted bg-surface shrink-0"
          >
            ⌘K
          </kbd>
        </label>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          class="relative inline-flex items-center justify-center w-10 h-10 border border-border rounded-lg bg-surface text-text cursor-pointer shrink-0 transition-colors hover:bg-primary-soft hover:no-underline"
          aria-label="Notifications"
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
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <span
            class="absolute top-2 right-[9px] w-1.5 h-1.5 rounded-full bg-primary border-2 border-surface"
            aria-hidden="true"
          ></span>
        </button>

        <button
          type="button"
          class="inline-flex items-center justify-center w-10 h-10 border border-border rounded-lg bg-surface text-text cursor-pointer shrink-0 transition-colors hover:bg-primary-soft hover:no-underline"
          aria-label="Toggle theme"
          onclick={toggleTheme}
        >
          {#if theme === 'dark'}
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
              <circle cx="12" cy="12" r="4" />
              <path
                d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
              />
            </svg>
          {:else}
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
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
            </svg>
          {/if}
        </button>

        {#if user}
          <div class="relative" bind:this={menuRef}>
            <button
              type="button"
              class="flex items-center gap-2 h-10 px-2.5 py-1 border border-border rounded-full bg-surface text-text cursor-pointer transition-colors hover:bg-primary-soft max-md:p-1"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onclick={() => (menuOpen = !menuOpen)}
            >
              {#if user.avatarUrl}
                <img
                  class="w-8 h-8 rounded-full object-cover"
                  src={user.avatarUrl}
                  alt=""
                />
              {:else}
                <span
                  class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-bold tracking-tight shrink-0"
                  aria-hidden="true"
                >
                  {initials(user.name)}
                </span>
              {/if}
              <span
                class="flex flex-col items-start leading-tight max-md:hidden"
              >
                <span class="text-sm font-semibold max-w-[140px] truncate">
                  {user.name}
                </span>
              </span>
              <span class="inline-flex text-muted max-md:hidden">
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </button>

            {#if menuOpen}
              <div
                class="absolute top-full right-0 mt-2 w-60 bg-surface border border-border rounded-card shadow-card p-1 z-40 animate-[menu-in_120ms_ease]"
                role="menu"
              >
                <div class="flex items-center gap-1.5 px-2.5 pt-2 pb-2.5">
                  {#if user.avatarUrl}
                    <img
                      class="w-11 h-11 rounded-full object-cover"
                      src={user.avatarUrl}
                      alt=""
                    />
                  {:else}
                    <span
                      class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0"
                      aria-hidden="true"
                    >
                      {initials(user.name)}
                    </span>
                  {/if}
                  <div class="flex flex-col min-w-0">
                    <span class="text-sm font-semibold truncate">
                      {user.name}
                    </span>
                    <span class="text-xs text-muted truncate">
                      {user.email}
                    </span>
                  </div>
                </div>
                <div class="h-px bg-border my-1.5"></div>
                <Link
                  href="/profile"
                  class="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg bg-transparent text-text text-sm text-left cursor-pointer transition-colors hover:bg-primary-soft hover:no-underline"
                  role="menuitem"
                >
                  Profile
                </Link>
                <div class="h-px bg-border my-1.5"></div>
                <button
                  type="button"
                  class="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg bg-transparent text-danger text-sm text-left cursor-pointer transition-colors hover:bg-primary-soft hover:no-underline"
                  role="menuitem"
                  onclick={handleLogout}
                >
                  <span class="inline-flex text-danger">
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
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <path d="m16 17 5-5-5-5M21 12H9" />
                    </svg>
                  </span>
                  <span>Log out</span>
                </button>
              </div>
            {/if}
          </div>
        {:else}
          <div class="flex items-center gap-2">
            <Link
              href="/login"
              class="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-border rounded-lg bg-transparent text-text font-semibold text-sm cursor-pointer transition-colors hover:bg-primary-soft hover:no-underline"
            >
              Log in
            </Link>
            <Link
              href="/register"
              class="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-primary rounded-lg bg-primary text-primary-foreground font-semibold text-sm cursor-pointer transition-colors hover:bg-primary-hover hover:border-primary-hover hover:no-underline"
            >
              Register
            </Link>
          </div>
        {/if}
      </div>
    </header>

    {#if flash?.success}
      <div
        class="w-full max-w-[1200px] mx-auto mt-4 px-4 py-3 text-sm font-medium rounded-lg border border-success-border bg-success-bg text-success-fg"
      >
        {String(flash.success)}
      </div>
    {/if}
    {#if flash?.error}
      <div
        class="w-full max-w-[1200px] mx-auto mt-4 px-4 py-3 text-sm font-medium rounded-lg border border-danger-border bg-danger-bg text-danger-fg"
      >
        {String(flash.error)}
      </div>
    {/if}

    <main
      class="flex-1 w-full max-w-[1200px] mx-auto px-5 py-6 max-md:px-4 max-md:py-5"
    >
      {@render children()}
    </main>

	  

	    <footer
	      class="mt-auto px-5 py-3.5 flex items-center justify-between gap-3 text-muted text-xs border-t border-border max-md:px-4 max-md:py-3"
	    >
	      <span>{settings['footer.text'] || settings['app.name'] || 'Honosvelte'}</span>
	      <span>
	        {settings['footer.copyright'] ||
	          `© ${new Date().getFullYear()} ${settings['app.name'] || 'Honosvelte'}`}
	      </span>
	    </footer>
  </div>
</div>
