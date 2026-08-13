<script lang="ts">
  import { usePage } from '@inertiajs/svelte'
  import PublicLayout from '../components/PublicLayout.svelte'
  import Card from '../components/Card.svelte'
  import Button from '../components/Button.svelte'
  import Badge from '../components/Badge.svelte'

  const page = usePage()
  const settings = $derived(page.props.settings ?? {})
  const appName = $derived(settings['app.name'] || 'Honosvelte')

  const services = [
    { title: 'Authentication & RBAC', desc: 'Email and social login, session security, roles, and permissions.', tags: ['Auth', 'OAuth', 'RBAC'] },
    { title: 'User & Role Management', desc: 'Full CRUD for users, roles, and permission assignment.', tags: ['Users', 'Roles', 'Permissions'] },
    { title: 'Media Library', desc: 'Uploads, metadata, categorization, and a media picker API.', tags: ['Uploads', 'Picker', 'CDN-ready'] },
    { title: 'Settings & Scripting', desc: 'Centralized app settings and head/body script injection.', tags: ['Config', 'Scripts'] },
    { title: 'Observability', desc: 'Activity logs, health checks, and operational metrics.', tags: ['Logs', 'Health'] },
    { title: 'Design System', desc: 'A themeable, token-driven component library for every screen.', tags: ['UI', 'Tokens'] },
  ]
</script>

<svelte:head><title>Services — {appName}</title></svelte:head>

<PublicLayout>
  <section class="mx-auto max-w-[1200px] px-5 py-16 max-md:px-4">
    <div class="max-w-[720px] mb-10">
      <Badge variant="primary" class="mb-3">What we offer</Badge>
      <h1 class="text-[2.2rem] font-bold tracking-tight m-0 mb-2">Services</h1>
      <p class="text-muted m-0">
        {appName} ships the modules most business systems need, so you can focus
        on the features that differentiate your product.
      </p>
    </div>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 mb-10">
      {#each services as s (s.title)}
        <Card class="p-6 flex flex-col gap-3">
          <h3 class="text-[1.1rem] font-semibold m-0">{s.title}</h3>
          <p class="text-muted text-sm m-0">{s.desc}</p>
          <div class="flex flex-wrap gap-2 mt-1">
            {#each s.tags as tag (tag)}
              <Badge variant="neutral">{tag}</Badge>
            {/each}
          </div>
        </Card>
      {/each}
    </div>

    <Card class="p-8 text-center flex flex-col items-center gap-4">
      <h2 class="text-[1.5rem] font-bold tracking-tight m-0">Not sure which fit you need?</h2>
      <p class="text-muted m-0 max-w-[480px]">Tell us about your product and we'll recommend a starting point.</p>
      <Button href="/contact" variant="primary" size="lg">Talk to us</Button>
    </Card>
  </section>
</PublicLayout>
