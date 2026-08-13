<script lang="ts">
  import { Link, usePage } from '@inertiajs/svelte'
  import PublicLayout from '../components/PublicLayout.svelte'
  import Card from '../components/Card.svelte'
  import Button from '../components/Button.svelte'
  import Avatar from '../components/Avatar.svelte'
  import Badge from '../components/Badge.svelte'

  const page = usePage()
  const settings = $derived(page.props.settings ?? {})
  const appName = $derived(settings['app.name'] || 'Honosvelte')

  const services = [
    { title: 'Web Platforms', desc: 'Production-ready admin panels, dashboards, and client portals.' },
    { title: 'Authentication', desc: 'Email, social login, RBAC, and secure session management.' },
    { title: 'Media & Content', desc: 'A unified media library and flexible content settings.' },
    { title: 'Observability', desc: 'Activity logs, health checks, and operational metrics.' },
    { title: 'Automation', desc: 'Notifications, tickets, and integrations with your stack.' },
    { title: 'Design System', desc: 'A consistent, themeable component library out of the box.' },
  ]

  const stats = [
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '12+', label: 'Built-in modules' },
    { value: '40+', label: 'UI components' },
    { value: '0', label: 'Boilerplate to wire' },
  ]

  const process = [
    { step: '01', title: 'Discover', desc: 'We map your workflows and define the modules you need.' },
    { step: '02', title: 'Build', desc: 'We scaffold on the starterkit so features ship faster.' },
    { step: '03', title: 'Launch', desc: 'You deploy with observability and security baked in.' },
  ]

  const testimonials = [
    { name: 'Aria Wijaya', role: 'CTO, Nusa Labs', quote: 'We cut our time-to-first-release in half by starting from this foundation.' },
    { name: 'Budi Santoso', role: 'Founder, Karya', quote: 'Auth, roles, and media were done on day one. Huge head start.' },
    { name: 'Citra Dewi', role: 'PM, Lintas', quote: 'The admin UX is clean and our team actually enjoys using it.' },
  ]

  const team = [
    { name: 'Dewi Anggraini', role: 'Engineering Lead' },
    { name: 'Eka Prasetyo', role: 'Product Designer' },
    { name: 'Farhan Rahman', role: 'Platform Engineer' },
    { name: 'Gita Maharani', role: 'Customer Success' },
  ]

  const partners = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Soylent', 'Stark', 'Wayne']
</script>

<svelte:head><title>{appName} — Company Website</title></svelte:head>

<PublicLayout>
  <!-- Hero -->
  <section class="relative overflow-hidden">
    <div class="absolute inset-0 -z-10 bg-[radial-gradient(700px_320px_at_70%_-10%,var(--primary-soft),transparent_70%)]"></div>
    <div class="mx-auto max-w-[1200px] px-5 py-20 md:py-28 max-md:px-4">
      <div class="max-w-[720px]">
        <Badge variant="primary" class="mb-4">Starterkit for business systems</Badge>
        <h1 class="text-[2.6rem] leading-[1.1] font-bold tracking-tight m-0 mb-4">
          Ship your product on a foundation that's already built.
        </h1>
        <p class="text-[1.05rem] text-muted mb-7 max-w-[600px]">
          {appName} gives you authentication, user management, RBAC, media, and
          observability out of the box — so your team builds the features that
          matter, not the boilerplate.
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <Button href="/register" variant="primary" size="lg">Get started</Button>
          <Button href="/services" variant="secondary" size="lg">Explore services</Button>
        </div>
      </div>
    </div>
  </section>

  <!-- Marquee -->
  <section class="border-y border-border bg-surface/60 py-4 overflow-hidden">
    <div class="flex w-max animate-[marquee_30s_linear_infinite] gap-12 px-6">
      {#each [...partners, ...partners] as name, i (i)}
        <span class="text-muted font-semibold text-lg whitespace-nowrap">{name}</span>
      {/each}
    </div>
  </section>

  <!-- Services -->
  <section class="mx-auto max-w-[1200px] px-5 py-16 max-md:px-4">
    <div class="mb-8">
      <h2 class="text-[1.8rem] font-bold tracking-tight m-0 mb-1">Services</h2>
      <p class="text-muted m-0">Everything you need to launch and operate a modern web product.</p>
    </div>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
      {#each services as s (s.title)}
        <Card class="p-6 flex flex-col gap-2">
          <h3 class="text-[1.05rem] font-semibold m-0">{s.title}</h3>
          <p class="text-muted text-sm m-0">{s.desc}</p>
        </Card>
      {/each}
    </div>
  </section>

  <!-- Statistics -->
  <section class="bg-surface/60 border-y border-border">
    <div class="mx-auto max-w-[1200px] px-5 py-12 grid grid-cols-2 md:grid-cols-4 gap-6 max-md:px-4">
      {#each stats as st (st.label)}
        <div class="text-center">
          <div class="text-[2rem] font-bold text-primary">{st.value}</div>
          <div class="text-muted text-sm">{st.label}</div>
        </div>
      {/each}
    </div>
  </section>

  <!-- Process -->
  <section class="mx-auto max-w-[1200px] px-5 py-16 max-md:px-4">
    <div class="mb-8">
      <h2 class="text-[1.8rem] font-bold tracking-tight m-0 mb-1">How we work</h2>
      <p class="text-muted m-0">A simple, repeatable path from idea to launch.</p>
    </div>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
      {#each process as p (p.step)}
        <Card class="p-6 flex flex-col gap-2">
          <span class="text-primary font-bold text-sm tracking-widest">{p.step}</span>
          <h3 class="text-[1.05rem] font-semibold m-0">{p.title}</h3>
          <p class="text-muted text-sm m-0">{p.desc}</p>
        </Card>
      {/each}
    </div>
  </section>

  <!-- Testimonials -->
  <section class="bg-surface/60 border-y border-border">
    <div class="mx-auto max-w-[1200px] px-5 py-16 max-md:px-4">
      <h2 class="text-[1.8rem] font-bold tracking-tight m-0 mb-8">What teams say</h2>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
        {#each testimonials as t (t.name)}
          <Card class="p-6 flex flex-col gap-3">
            <p class="text-[0.98rem] m-0">“{t.quote}”</p>
            <div class="flex items-center gap-3 mt-1">
              <Avatar name={t.name} size="sm" />
              <div class="leading-tight">
                <div class="text-sm font-semibold">{t.name}</div>
                <div class="text-xs text-muted">{t.role}</div>
              </div>
            </div>
          </Card>
        {/each}
      </div>
    </div>
  </section>

  <!-- Team -->
  <section class="mx-auto max-w-[1200px] px-5 py-16 max-md:px-4">
    <h2 class="text-[1.8rem] font-bold tracking-tight m-0 mb-8">Meet the team</h2>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
      {#each team as m (m.name)}
        <div class="flex flex-col items-center gap-3 text-center p-4">
          <Avatar name={m.name} size="lg" />
          <div>
            <div class="text-sm font-semibold">{m.name}</div>
            <div class="text-xs text-muted">{m.role}</div>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- Contact CTA -->
  <section class="mx-auto max-w-[1200px] px-5 py-16 max-md:px-4">
    <Card class="p-8 md:p-12 text-center flex flex-col items-center gap-4">
      <h2 class="text-[1.9rem] font-bold tracking-tight m-0">Let's build something</h2>
      <p class="text-muted m-0 max-w-[520px]">
        Tell us about your project and we'll show you how {appName} fits. We usually
        reply within one business day.
      </p>
      <Button href="/contact" variant="primary" size="lg">Contact us</Button>
    </Card>
  </section>
</PublicLayout>
