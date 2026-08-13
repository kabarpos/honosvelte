<script lang="ts">
  import { Link, router, useForm, usePage } from '@inertiajs/svelte'
  import Layout from '../components/Layout.svelte'
  import Card from '../components/Card.svelte'
  import Button from '../components/Button.svelte'
  import Badge from '../components/Badge.svelte'
  import Modal from '../components/Modal.svelte'
  import Pagination from '../components/Pagination.svelte'
  import EmptyState from '../components/EmptyState.svelte'
  import type { ContactMessage, Paginated } from '../../shared/types'
  import { formatDateTime } from '../intl'

  let {
    messages,
    statuses,
    status,
    search,
    counts,
  }: {
    messages: Paginated<ContactMessage>
    statuses: string[]
    status: string
    search: string
    counts: Record<string, number>
  } = $props()

  const { currentPage, lastPage } = $derived(messages.meta)
  const pageStore = usePage()
  const settings = $derived(pageStore.props.settings ?? {})

  let searchForm = $state(useForm({ q: search }))
  let page = $state(currentPage)
  let didInit = true

  let detailOpen = $state(false)
  let detail = $state<ContactMessage | null>(null)

  // Bulk selection
  let selected = $state<Set<number>>(new Set())
  let bulkAction = $state<'read' | 'archive' | 'delete'>('read')
  let bulkBusy = $state(false)

  $effect(() => {
    if (didInit) {
      didInit = false
      return
    }
    router.get(
      '/contact/inbox',
      { page, status, search: searchForm.q },
      { preserveState: true, replace: true },
    )
  })

  function doSearch(e: SubmitEvent) {
    e.preventDefault()
    router.get('/contact/inbox', { page: 1, status, search: searchForm.q }, {
      preserveState: true,
      replace: true,
    })
  }

  function setStatus(v: string) {
    router.get('/contact/inbox', { page: 1, status: v, search: searchForm.q }, {
      preserveState: true,
      replace: true,
    })
  }

  async function openDetail(id: number) {
    const res = await fetch(`/contact/inbox/${id}`, { headers: { accept: 'application/json' } })
    if (!res.ok) return
    const body = (await res.json()) as { message: ContactMessage }
    detail = body.message
    detailOpen = true
  }

  function statusMeta(s: string): { label: string; tone: 'primary' | 'amber' | 'neutral' } {
    switch (s) {
      case 'unread':
        return { label: 'Unread', tone: 'primary' }
      case 'read':
        return { label: 'Read', tone: 'neutral' }
      case 'replied':
        return { label: 'Replied', tone: 'amber' }
      case 'archived':
        return { label: 'Archived', tone: 'neutral' }
      default:
        return { label: s, tone: 'neutral' }
    }
  }

  // --- Reply (email) -------------------------------------------------------
  let replyText = $state('')
  let replyBusy = $state(false)
  let replyStatus = $state<{ ok: boolean; message: string } | null>(null)

  async function sendReply() {
    if (!detail) return
    replyBusy = true
    replyStatus = null
    try {
      const res = await fetch(`/contact/inbox/${detail.id}/reply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: replyText }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (res.ok && data.ok) {
        replyStatus = { ok: true, message: 'Reply sent.' }
        replyText = ''
        if (detail) detail = { ...detail, status: 'replied' }
      } else {
        replyStatus = { ok: false, message: data.error ?? 'Send failed.' }
      }
    } finally {
      replyBusy = false
    }
  }

  function setOneStatus(s: string) {
    if (!detail) return
    const id = detail.id
    fetch(`/contact/inbox/${id}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: s }),
    })
      .then(() => {
        if (detail) detail = { ...detail, status: s as ContactMessage['status'] }
      })
      .catch(() => {})
  }

  // --- Bulk ---------------------------------------------------------------
  function toggle(id: number) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selected = next
  }
  function toggleAll() {
    if (selected.size === messages.data.length && messages.data.length > 0) {
      selected = new Set()
    } else {
      selected = new Set(messages.data.map((m) => m.id))
    }
  }

  async function submitBulk(e: SubmitEvent) {
    e.preventDefault()
    if (selected.size === 0) return
    bulkBusy = true
    try {
      const res = await fetch('/contact/inbox/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: [...selected], action: bulkAction }),
      })
      if (res.ok) {
        selected = new Set()
        router.reload({ only: ['messages', 'counts'] })
      }
    } finally {
      bulkBusy = false
    }
  }
</script>

<svelte:head><title>Contact inbox</title></svelte:head>

<Layout>
  <div class="flex items-start justify-between gap-4 mb-3">
    <div>
      <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">Contact inbox</h1>
      <p class="text-muted mb-0">
        {messages.meta.total} message{messages.meta.total === 1 ? '' : 's'} — page
        {currentPage} of {lastPage}.
      </p>
    </div>
    <Link href="/contact" class="text-sm text-muted hover:text-text">View form →</Link>
  </div>

  <!-- Status filter tabs -->
  <div class="flex flex-wrap gap-2 mb-4">
    <button
      type="button"
      class="px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors {status === '' ? 'bg-primary-soft border-primary text-primary' : 'border-border bg-surface text-text hover:bg-primary-soft'}"
      onclick={() => setStatus('')}
    >
      All <span class="text-muted">({counts.all ?? messages.meta.total})</span>
    </button>
    {#each statuses as s (s)}
      {@const meta = statusMeta(s)}
      <button
        type="button"
        class="px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors {status === s ? 'bg-primary-soft border-primary text-primary' : 'border-border bg-surface text-text hover:bg-primary-soft'}"
        onclick={() => setStatus(s)}
      >
        {meta.label} <span class="text-muted">({counts[s] ?? 0})</span>
      </button>
    {/each}
  </div>

  <form class="mb-4 flex flex-wrap gap-2" onsubmit={doSearch}>
    <input
      type="search"
      name="q"
      class="w-full max-w-[320px] px-3 py-2.5 border border-border rounded-lg bg-bg text-text text-sm focus:outline-2 focus:outline-primary focus:-outline-offset-1"
      placeholder="Search name, email, message…"
      bind:value={searchForm.q}
      aria-label="Search messages"
    />
    <Button variant="secondary" type="submit">Search</Button>
  </form>

  {#if messages.data.length === 0}
    <EmptyState
      title="No messages"
      description={search || status ? 'Nothing matched your filters.' : 'Visitor messages will appear here.'}
    />
  {:else}
    <form onsubmit={submitBulk}>
      <Card class="p-0 overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border text-left">
              <th class="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={selected.size === messages.data.length && messages.data.length > 0}
                  onchange={toggleAll}
                />
              </th>
              <th class="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted">From</th>
              <th class="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Subject</th>
              <th class="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Status</th>
              <th class="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Received</th>
              <th class="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each messages.data as m (m.id)}
              {@const meta = statusMeta(m.status)}
              <tr class="hover:bg-primary-soft/50">
                <td class="px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select message ${m.id}`}
                    checked={selected.has(m.id)}
                    onchange={() => toggle(m.id)}
                  />
                </td>
                <td class="px-3 py-3">
                  <div class="font-medium text-text">{m.name}</div>
                  <div class="text-muted text-xs">{m.email}</div>
                </td>
                <td class="px-3 py-3 text-text max-w-[280px]">
                  <span class="line-clamp-1">{m.subject ?? '(no subject)'}</span>
                </td>
                <td class="px-3 py-3"><Badge variant={meta.tone}>{meta.label}</Badge></td>
                <td class="px-3 py-3 text-muted whitespace-nowrap">{formatDateTime(m.createdAt, settings)}</td>
                <td class="px-3 py-3 text-right">
                  <button
                    type="button"
                    class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-border rounded-lg bg-transparent text-text cursor-pointer transition-colors hover:bg-primary-soft"
                    onclick={() => openDetail(m.id)}
                  >View</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </Card>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <select bind:value={bulkAction} class="px-3 py-2 border border-border rounded-lg bg-bg text-text text-sm">
            <option value="read">Mark read</option>
            <option value="archived">Archive</option>
            <option value="delete">Delete</option>
          </select>
          <Button type="submit" variant="secondary" loading={bulkBusy} disabled={selected.size === 0}>
            Apply ({selected.size})
          </Button>
        </div>
        <Pagination bind:page totalPages={lastPage} />
      </div>
    </form>
  {/if}

  {#if detail}
    <Modal open={detailOpen} title={`Message from ${detail.name}`} size="lg">
      <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm items-baseline mb-4">
        <span class="text-muted">Email</span>
        <span class="font-medium text-text break-all">{detail.email}</span>
        <span class="text-muted">Subject</span>
        <span class="text-text">{detail.subject ?? '—'}</span>
        <span class="text-muted">Status</span>
        <span><Badge variant={statusMeta(detail.status).tone}>{statusMeta(detail.status).label}</Badge></span>
        <span class="text-muted">Received</span>
        <span class="text-text">{formatDateTime(detail.createdAt, settings)}</span>
      </div>
      <div class="rounded-card border border-border bg-bg p-4 text-sm whitespace-pre-wrap">{detail.message}</div>

      <div class="flex flex-wrap gap-2 mt-4">
        {#if detail.status !== 'read'}
          <Button variant="ghost" type="button" onclick={() => setOneStatus('read')}>Mark read</Button>
        {/if}
        {#if detail.status !== 'archived'}
          <Button variant="ghost" type="button" onclick={() => setOneStatus('archived')}>Archive</Button>
        {/if}
      </div>

      <hr class="border-border my-4" />

      <label class="block text-sm font-semibold mb-1.5" for="ci-reply">Reply by email</label>
      <textarea
        id="ci-reply"
        rows={4}
        class="w-full px-3 py-2 border border-border rounded-lg bg-bg text-text text-sm focus:outline-2 focus:outline-primary focus:-outline-offset-1"
        placeholder="Type your reply…"
        bind:value={replyText}
      ></textarea>
      {#if replyStatus}
        <p class="text-xs mt-1.5 {replyStatus.ok ? 'text-success-fg' : 'text-danger'}">{replyStatus.message}</p>
      {/if}
      <div class="flex items-center justify-end gap-2 mt-3">
        <Button variant="ghost" type="button" onclick={() => (detailOpen = false)}>Close</Button>
        <Button variant="primary" type="button" loading={replyBusy} disabled={!replyText.trim()} onclick={sendReply}>
          Send reply
        </Button>
      </div>
    </Modal>
  {/if}
</Layout>
