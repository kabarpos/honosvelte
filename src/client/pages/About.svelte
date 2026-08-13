<script lang="ts">
  import { usePage } from '@inertiajs/svelte'
  import PublicLayout from '../components/PublicLayout.svelte'
  import Card from '../components/Card.svelte'
  import Button from '../components/Button.svelte'

  const page = usePage()
  const settings = $derived(page.props.settings ?? {})
  const appName = $derived(settings['app.name'] || 'Honosvelte')

  const values = [
    { title: 'Foundations first', desc: 'We invest in the boring infrastructure so product work stays fun.' },
    { title: 'Secure by default', desc: 'Auth, RBAC, and observability are part of the base, not an add-on.' },
    { title: 'Operable', desc: 'Clear logs, health checks, and settings you can change without a deploy.' },
  ]
</script>

<svelte:head><title>About — {appName}</title></svelte:head>

<PublicLayout>
  <section class="mx-auto max-w-[860px] px-5 py-16 max-md:px-4">
    <h1 class="text-[2.2rem] font-bold tracking-tight m-0 mb-3">About {appName}</h1>
    <p class="text-[1.05rem] text-muted mb-8">
      {appName} is a starterkit for building business systems. We believe teams
      should spend their time on the product, not on re-assembling the same
      authentication, user management, and admin scaffolding for the hundredth
      time.
    </p>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-10">
      {#each values as v (v.title)}
        <Card class="p-6 flex flex-col gap-2">
          <h3 class="text-[1.05rem] font-semibold m-0">{v.title}</h3>
          <p class="text-muted text-sm m-0">{v.desc}</p>
        </Card>
      {/each}
    </div>

    <Card class="p-8 text-center flex flex-col items-center gap-4">
      <h2 class="text-[1.5rem] font-bold tracking-tight m-0">Want to see it in action?</h2>
      <p class="text-muted m-0 max-w-[480px]">
        Create an account or reach out — we'll help you map the starterkit to your product.
      </p>
      <div class="flex flex-wrap items-center justify-center gap-3">
        <Button href="/register" variant="primary" size="lg">Get started</Button>
        <Button href="/contact" variant="secondary" size="lg">Contact us</Button>
      </div>
    </Card>
  </section>
</PublicLayout>
