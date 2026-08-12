<script lang="ts">
  import { router, useForm } from '@inertiajs/svelte'
  import Layout from '../components/Layout.svelte'
  import Card from '../components/Card.svelte'
  import Input from '../components/Input.svelte'
  import Button from '../components/Button.svelte'
  import Badge from '../components/Badge.svelte'
  import Modal from '../components/Modal.svelte'
  import Pagination from '../components/Pagination.svelte'
  import EmptyState from '../components/EmptyState.svelte'
  import type { ActivityLogEntry, Paginated } from '../../shared/types'

  let { activity, events, event, search }: {
    activity: Paginated<ActivityLogEntry>
    events: string[]
    event: string
    search: string
  } = $props()

  const { currentPage, lastPage } = $derived(activity.meta)

  let searchForm = $state(useForm({ q: search }))
  let page = $state(currentPage)
  let didInit = true

  let detailOpen = $state(false)
  let detailEntry = $state<ActivityLogEntry | null>(null)

  $effect(() => {
    if (didInit) {
      didInit = false
      return
    }
    router.get(
      '/activity',
      { page, event, search: searchForm.q },
      { preserveState: true, replace: true },
    )
  })

  function doSearch(e: SubmitEvent) {
    e.preventDefault()
    router.get('/activity', { page: 1, event, search: searchForm.q }, {
      preserveState: true,
      replace: true,
    })
  }

  function setEvent(v: string) {
    router.get('/activity', { page: 1, event: v, search: searchForm.q }, {
      preserveState: true,
      replace: true,
    })
  }

  function openDetail(entry: ActivityLogEntry) {
    detailEntry = entry
    detailOpen = true
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /** Map an event slug to a readable label and badge tone. */
  function eventMeta(event: string): { label: string; tone: 'primary' | 'amber' | 'neutral' } {
    const [scope, action] = event.split('.')
    const actionLabel: Record<string, string> = {
      login: 'Sign in',
      logout: 'Sign out',
      register: 'Registered',
      create: 'Created',
      update: 'Updated',
      delete: 'Deleted',
      activate: 'Activated',
      deactivate: 'Deactivated',
      assign: 'Assigned',
      upload: 'Uploaded',
      change: 'Changed',
    }
    const key = action ?? ''
    const label = actionLabel[key] ?? event
    if (action === 'create' || action === 'register' || action === 'upload') return { label, tone: 'primary' }
    if (action === 'assign' || action === 'activate') return { label, tone: 'amber' }
    return { label: scope ? `${scope} · ${label}` : label, tone: 'neutral' }
  }
</script>

<svelte:head><title>Activity Log</title></svelte:head>

<Layout>
  <div class="flex items-start justify-between gap-4 mb-3">
    <div>
      <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">Activity log</h1>
      <p class="text-muted mb-0">
        {activity.meta.total} entr{activity.meta.total === 1 ? 'y' : 'ies'} — page
        {currentPage} of {lastPage}.
      </p>
    </div>
  </div>

  <form class="mb-4 flex flex-wrap gap-2" onsubmit={doSearch}>
    <input
      type="search"
      name="q"
      class="w-full max-w-[320px] px-3 py-2.5 border border-border rounded-lg bg-bg text-text text-sm focus:outline-2 focus:outline-primary focus:-outline-offset-1"
      placeholder="Search user, event, detail…"
      bind:value={searchForm.q}
      aria-label="Search activity"
    />
    <select
      class="px-3 py-2.5 border border-border rounded-lg bg-bg text-text text-sm focus:outline-2 focus:outline-primary focus:-outline-offset-1"
      value={event}
      onchange={(e) => setEvent((e.currentTarget as HTMLSelectElement).value)}
      aria-label="Filter by event"
    >
      <option value="">All events</option>
      {#each events as ev (ev)}
        <option value={ev}>{ev}</option>
      {/each}
    </select>
    <Button variant="secondary" type="submit">Search</Button>
  </form>

  {#if activity.data.length === 0}
    <EmptyState
      title="No activity"
      description={search || event ? 'Nothing matched your filters.' : 'Actions will appear here as users sign in and change data.'}
    />
  {:else}
    <Card class="p-0 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-border text-left">
            <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">User</th>
            <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Event</th>
            <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Method</th>
            <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">URL</th>
            <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">When</th>
            <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          {#each activity.data as entry (entry.id)}
            {@const meta = eventMeta(entry.event)}
            <tr class="hover:bg-primary-soft/50">
              <td class="px-4 py-3 font-medium text-text">{entry.userName ?? 'Guest'}</td>
              <td class="px-4 py-3">
                <Badge variant={meta.tone}>{meta.label}</Badge>
              </td>
              <td class="px-4 py-3 text-muted">{entry.method ?? '—'}</td>
              <td class="px-4 py-3 text-muted truncate max-w-[220px]">{entry.url ?? '—'}</td>
              <td class="px-4 py-3 text-muted whitespace-nowrap">{formatDate(entry.createdAt)}</td>
              <td class="px-4 py-3 text-right">
                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-border rounded-lg bg-transparent text-text cursor-pointer transition-colors hover:bg-primary-soft"
                  onclick={() => openDetail(entry)}
                >Detail</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </Card>
  {/if}

  <div class="mt-4 flex justify-end">
    <Pagination bind:page totalPages={lastPage} />
  </div>

  {#if detailEntry}
    <Modal open={detailOpen} title="Activity detail" size="md">
      <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm items-baseline">
        <span class="text-muted">User</span>
        <span class="font-medium text-text">{detailEntry.userName ?? 'Guest'}</span>
        <span class="text-muted">Event</span>
        <span class="font-medium text-text">{detailEntry.event}</span>
        <span class="text-muted">Detail</span>
        <span class="text-text">{detailEntry.detail ?? '—'}</span>
        <span class="text-muted">Method</span>
        <span class="text-text">{detailEntry.method ?? '—'}</span>
        <span class="text-muted">URL</span>
        <span class="text-text break-all">{detailEntry.url ?? '—'}</span>
        <span class="text-muted">IP address</span>
        <span class="text-text">{detailEntry.ip ?? '—'}</span>
        <span class="text-muted">When</span>
        <span class="text-text">{formatDate(detailEntry.createdAt)}</span>
      </div>
      <div class="flex items-center justify-end gap-2 mt-4">
        <Button variant="ghost" type="button" onclick={() => (detailOpen = false)}>Close</Button>
      </div>
    </Modal>
  {/if}
</Layout>
