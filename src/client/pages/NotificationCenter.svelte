<script lang="ts">
  import { router, usePage } from '@inertiajs/svelte'
  import Layout from '../components/Layout.svelte'
  import Card from '../components/Card.svelte'
  import Button from '../components/Button.svelte'
  import Badge from '../components/Badge.svelte'
  import Pagination from '../components/Pagination.svelte'
  import EmptyState from '../components/EmptyState.svelte'
  import type { Notification, Paginated } from '../../shared/types'
  import { formatDateTime } from '../intl'

  let { notifications, unread }: { notifications: Paginated<Notification>; unread: number } =
    $props()

  const { currentPage, lastPage } = $derived(notifications.meta)
  const pageStore = usePage()
  const settings = $derived(pageStore.props.settings ?? {})
  let page = $state(currentPage)
  let didInit = true

  $effect(() => {
    if (didInit) {
      didInit = false
      return
    }
    router.get('/notifications', { page }, { preserveState: true, replace: true })
  })

  let marking = $state<number | null>(null)

  async function markRead(id: number) {
    marking = id
    try {
      await fetch(`/notifications/${id}/read`, { method: 'POST' })
      router.reload({ only: ['notifications', 'unread'] })
    } finally {
      marking = null
    }
  }

  let markingAll = $state(false)
  async function markAllRead() {
    markingAll = true
    try {
      await fetch('/notifications/read-all', { method: 'POST' })
      router.reload({ only: ['notifications', 'unread'] })
    } finally {
      markingAll = false
    }
  }

  function typeMeta(type: string): { label: string; tone: 'primary' | 'amber' | 'neutral' } {
    switch (type) {
      case 'contact':
        return { label: 'Contact', tone: 'primary' }
      case 'whatsapp':
        return { label: 'WhatsApp', tone: 'amber' }
      default:
        return { label: 'Info', tone: 'neutral' }
    }
  }
</script>

<svelte:head><title>Notifications</title></svelte:head>

<Layout>
  <div class="flex items-start justify-between gap-4 mb-3">
    <div>
      <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">Notifications</h1>
      <p class="text-muted mb-0">
        {unread} unread · {notifications.meta.total} total.
      </p>
    </div>
    <Button
      variant="secondary"
      type="button"
      loading={markingAll}
      disabled={unread === 0}
      onclick={markAllRead}
    >
      Mark all read
    </Button>
  </div>

  {#if notifications.data.length === 0}
    <EmptyState title="No notifications" description="You're all caught up." />
  {:else}
    <Card class="p-0 overflow-hidden">
      <ul class="divide-y divide-border">
        {#each notifications.data as n (n.id)}
          {@const meta = typeMeta(n.type)}
          <li class="flex items-start gap-3 px-4 py-3 {n.read ? '' : 'bg-primary-soft/40'}">
            <span class="mt-1">
              <Badge variant={meta.tone}>{meta.label}</Badge>
            </span>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-text {n.read ? 'opacity-70' : ''}">{n.title}</p>
              {#if n.body}<p class="text-sm text-muted mt-0.5 whitespace-pre-wrap">{n.body}</p>{/if}
              <p class="text-xs text-muted mt-1">{formatDateTime(n.createdAt, settings)}</p>
            </div>
            {#if !n.read}
              <Button
                variant="ghost"
                size="sm"
                type="button"
                loading={marking === n.id}
                onclick={() => markRead(n.id)}
              >
                Mark read
              </Button>
            {/if}
          </li>
        {/each}
      </ul>
    </Card>
    <div class="mt-4 flex justify-end">
      <Pagination bind:page totalPages={lastPage} />
    </div>
  {/if}
</Layout>
