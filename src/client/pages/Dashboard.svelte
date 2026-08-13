<script lang="ts">
  import { usePage } from '@inertiajs/svelte'
  import Layout from '../components/Layout.svelte'

  const page = usePage()
  const user = $derived(page.props.auth.user)
</script>

<svelte:head><title>Dashboard</title></svelte:head>

{#if user}
  <Layout>
    <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">Dashboard</h1>
    <p class="text-muted mb-6">Signed in as <strong>{user.email}</strong>.</p>

    <div
      class="flex items-center justify-center rounded-card border border-dashed border-border bg-surface p-12 text-center"
    >
      <div class="max-w-md">
        <p class="m-0 text-base font-semibold">Empty placeholder</p>
        <p class="mt-2 m-0 text-sm text-muted">
          This page is a placeholder. Fill it with any content you like — stats,
          widgets, tables, or whatever your app needs.
        </p>
      </div>
    </div>
  </Layout>
{/if}
