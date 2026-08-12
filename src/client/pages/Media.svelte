<script lang="ts">
  import { router, useForm, usePage } from '@inertiajs/svelte'
  import Layout from '../components/Layout.svelte'
  import Card from '../components/Card.svelte'
  import Field from '../components/Field.svelte'
  import Input from '../components/Input.svelte'
  import Button from '../components/Button.svelte'
  import Badge from '../components/Badge.svelte'
  import Modal from '../components/Modal.svelte'
  import Pagination from '../components/Pagination.svelte'
  import type { Media, MediaCategory, Paginated } from '../../shared/types'
  import { formatDate } from '../intl'

  let { media, categories, search, category }: {
    media: Paginated<Media>
    categories: MediaCategory[]
    search: string
    category: string
  } = $props()

  const { currentPage, lastPage } = $derived(media.meta)

  const pageStore = usePage()
  const settings = $derived(pageStore.props.settings ?? {})

  let searchForm = $state(useForm({ q: search }))
  let page = $state(currentPage)
  let didInit = true

  let editOpen = $state(false)
  let editMedia = $state<Media | null>(null)
  let deleteOpen = $state(false)
  let deleteMedia = $state<Media | null>(null)
  let uploading = $state(false)
  let uploadDone = $state(0)
  let uploadTotal = $state(0)
  let uploadError = $state('')

  let viewOpen = $state(false)
  let viewIndex = $state(0)

  const viewMedia = $derived(media.data[viewIndex] ?? null)

  let editForm = $state(
    useForm({ originalName: '', title: '', altText: '', description: '' }),
  )
  let deleteForm = $state(useForm({}))

  $effect(() => {
    if (didInit) {
      didInit = false
      return
    }
    router.get(
      '/media',
      { page, category, search: searchForm.q },
      { preserveState: true, replace: true },
    )
  })

  function doSearch(e: SubmitEvent) {
    e.preventDefault()
    page = 1
    router.get('/media', { page: 1, category, search: searchForm.q }, {
      preserveState: true,
      replace: true,
    })
  }

  function setCategory(c: string) {
    page = 1
    router.get('/media', { page: 1, category: c, search: searchForm.q }, {
      preserveState: true,
      replace: true,
    })
  }

  function openEdit(m: Media) {
    editMedia = m
    editForm.setStore({
      originalName: m.originalName,
      title: m.title ?? '',
      altText: m.altText ?? '',
      description: m.description ?? '',
    })
    editForm.clearErrors()
    editOpen = true
  }

  function openLightbox(i: number) {
    viewIndex = i
    viewOpen = true
  }

  function stepLightbox(dir: 1 | -1) {
    if (media.data.length === 0) return
    viewIndex = (viewIndex + dir + media.data.length) % media.data.length
  }

  function onLightboxKey(e: KeyboardEvent) {
    if (!viewOpen) return
    if (e.key === 'Escape') viewOpen = false
    if (e.key === 'ArrowRight') stepLightbox(1)
    if (e.key === 'ArrowLeft') stepLightbox(-1)
  }

  function submitEdit(e: SubmitEvent) {
    e.preventDefault()
    if (!editMedia) return
    editForm.patch(`/media/${editMedia.id}`, {
      onSuccess: () => {
        editOpen = false
        editMedia = null
      },
    })
  }

  function submitDelete(e: SubmitEvent) {
    e.preventDefault()
    if (!deleteMedia) return
    deleteForm.delete(`/media/${deleteMedia.id}`, {
      onSuccess: () => {
        deleteOpen = false
        deleteMedia = null
      },
    })
  }

  async function handleUpload(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const files = Array.from(input.files ?? [])
    if (files.length === 0) return
    uploading = true
    uploadDone = 0
    uploadTotal = files.length
    uploadError = ''
    let ok = 0
    try {
      for (let i = 0; i < files.length; i++) {
        uploadDone = i
        const file = files[i]!
        const res = await fetch('/media', {
          method: 'POST',
          headers: {
            'x-file-name': file.name,
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          uploadError = data?.error ?? `Upload failed: ${file.name}`
          continue
        }
        ok++
      }
      if (ok > 0) router.reload({ only: ['media'] })
    } catch {
      uploadError = 'Upload failed.'
    } finally {
      uploadDone = uploadTotal
      uploading = false
      input.value = ''
    }
  }

  function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / 1024 / 1024).toFixed(1)} MB`
  }

  function badgeVariant(c: MediaCategory): 'primary' | 'neutral' | 'amber' {
    if (c === 'image') return 'primary'
    if (c === 'archive') return 'amber'
    return 'neutral'
  }

  const wrapper =
    'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-border rounded-lg bg-transparent text-text cursor-pointer transition-colors hover:bg-primary-soft'
</script>

<svelte:head><title>Media</title></svelte:head>
<svelte:window onkeydown={onLightboxKey} />

<Layout>
  <div class="flex items-start justify-between gap-4 mb-3">
    <div>
      <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">Media library</h1>
      <p class="text-muted mb-0">
        {media.meta.total} file{media.meta.total === 1 ? '' : 's'} — page
        {currentPage} of {lastPage}.
      </p>
    </div>
    <label
      class="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-primary rounded-lg bg-primary text-primary-foreground font-semibold text-sm cursor-pointer transition-colors hover:bg-primary-hover hover:border-primary-hover"
    >
      {uploading
        ? uploadTotal > 1
          ? `Uploading ${uploadDone + 1}/${uploadTotal}…`
          : 'Uploading…'
        : 'Upload files'}
      <input
        type="file"
        multiple
        class="sr-only"
        onchange={handleUpload}
        disabled={uploading}
        aria-label="Upload files"
      />
    </label>
  </div>

  {#if uploadError}
    <p class="mb-3 text-sm text-danger" role="alert">{uploadError}</p>
  {/if}

  <form class="mb-4 flex flex-wrap gap-2" onsubmit={doSearch}>
    <input
      type="search"
      name="q"
      class="w-full max-w-[320px] px-3 py-2.5 border border-border rounded-lg bg-bg text-text text-sm focus:outline-2 focus:outline-primary focus:-outline-offset-1"
      placeholder="Search files…"
      bind:value={searchForm.q}
      aria-label="Search media"
    />
    <select
      class="px-3 py-2.5 border border-border rounded-lg bg-bg text-text text-sm focus:outline-2 focus:outline-primary focus:-outline-offset-1"
      value={category}
      onchange={(e) => setCategory((e.currentTarget as HTMLSelectElement).value)}
      aria-label="Filter by category"
    >
      <option value="">All categories</option>
      {#each categories as c (c)}
        <option value={c}>{c}</option>
      {/each}
    </select>
    <Button variant="secondary" type="submit">Search</Button>
  </form>

  {#if media.data.length === 0}
    <Card class="p-10 text-center text-muted">
      No files {search || category ? 'matched your filters' : 'yet'}.
    </Card>
  {:else}
    <div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
      {#each media.data as m (m.id)}
        <Card class="p-0 overflow-hidden flex flex-col">
          {#if m.category === 'image' && m.mimeType.startsWith('image/')}
            <button
              type="button"
              class="block h-36 w-full bg-bg overflow-hidden cursor-zoom-in p-0 border-none"
              onclick={() => openLightbox(media.data.indexOf(m))}
              aria-label={`Preview ${m.originalName}`}
            >
              <img
                src={m.url}
                alt={m.altText ?? m.title ?? m.originalName}
                loading="lazy"
                class="w-full h-full object-cover"
              />
            </button>
          {:else}
            <a href={m.url} target="_blank" rel="noreferrer"
              aria-label={m.title ?? m.originalName}
              class="flex items-center justify-center h-36 bg-bg text-muted">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            </a>
          {/if}
          <div class="p-3 flex flex-col gap-1.5 flex-1">
            <p class="m-0 text-sm font-medium truncate" title={m.title ?? m.originalName}>
              {m.title ?? m.originalName}
            </p>
            <p class="m-0 text-xs text-muted truncate">{m.originalName}</p>
            <div class="flex items-center justify-between gap-2">
              <Badge variant={badgeVariant(m.category)}>{m.category}</Badge>
              <span class="text-xs text-muted">{formatBytes(m.size)}</span>
            </div>
            <p class="m-0 text-xs text-muted">{formatDate(m.createdAt, settings)}</p>
            <div class="flex items-center gap-1.5 mt-1">
              <button type="button" class={wrapper} onclick={() => openEdit(m)}>Edit</button>
              <button type="button" class={`${wrapper} text-danger`} onclick={() => { deleteMedia = m; deleteOpen = true }}>Delete</button>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}

  <div class="mt-4 flex justify-end">
    <Pagination bind:page totalPages={lastPage} />
  </div>

  {#if viewOpen && viewMedia}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${viewMedia.originalName}`}
    >
      <button
        type="button"
        class="absolute top-4 right-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-surface border border-border text-text cursor-pointer hover:bg-primary-soft"
        onclick={() => (viewOpen = false)}
        aria-label="Close preview"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <button
        type="button"
        class="absolute left-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-surface border border-border text-text cursor-pointer hover:bg-primary-soft"
        onclick={() => stepLightbox(-1)}
        aria-label="Previous image"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <div class="flex flex-col items-center max-w-[90vw] max-h-[92vh]">
        <img
          src={viewMedia.url}
          alt={viewMedia.altText ?? viewMedia.title ?? viewMedia.originalName}
          class="max-w-full max-h-[78vh] object-contain rounded-lg shadow-card"
        />
        <div class="mt-3 flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-2 max-w-[85vw]">
          <span class="text-sm font-medium truncate">{viewMedia.originalName}</span>
          <span class="text-xs text-muted whitespace-nowrap">{formatBytes(viewMedia.size)}</span>
          <span class="text-xs text-muted whitespace-nowrap">{viewIndex + 1} / {media.data.length}</span>
          <button
            type="button"
            class={wrapper}
            onclick={() => {
              viewOpen = false
              openEdit(viewMedia)
            }}
          >Edit</button>
        </div>
      </div>
      <button
        type="button"
        class="absolute right-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-surface border border-border text-text cursor-pointer hover:bg-primary-soft"
        onclick={() => stepLightbox(1)}
        aria-label="Next image"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  {/if}

  {#if editMedia}
    <Modal open={editOpen} title={`Edit ${editMedia.originalName}`} size="md">
      <form onsubmit={submitEdit} novalidate>
        <Field id="em-name" label="File name" error={editForm.errors.originalName}>
          <Input id="em-name" bind:value={editForm.originalName} onchange={() => editForm.clearErrors('originalName')} />
        </Field>
        <Field id="em-title" label="Title" error={editForm.errors.title}>
          <Input id="em-title" bind:value={editForm.title} onchange={() => editForm.clearErrors('title')} />
        </Field>
        <Field id="em-alt" label="Alt text" error={editForm.errors.altText}>
          <Input id="em-alt" bind:value={editForm.altText} onchange={() => editForm.clearErrors('altText')} />
        </Field>
        <Field id="em-desc" label="Description" error={editForm.errors.description}>
          <Input id="em-desc" bind:value={editForm.description} onchange={() => editForm.clearErrors('description')} />
        </Field>
        <div class="flex items-center justify-end gap-2 mt-4">
          <Button variant="ghost" type="button" onclick={() => (editOpen = false)}>Cancel</Button>
          <Button variant="primary" type="submit" loading={editForm.processing}>Save</Button>
        </div>
      </form>
    </Modal>
  {/if}

  {#if deleteMedia}
    <Modal open={deleteOpen} title="Delete file" size="sm">
      <p>Delete <strong>{deleteMedia.title ?? deleteMedia.originalName}</strong>? This cannot be undone.</p>
      <div class="flex items-center justify-end gap-2 mt-4">
        <Button variant="ghost" type="button" onclick={() => (deleteOpen = false)}>Cancel</Button>
        <Button variant="danger" type="button" loading={deleteForm.processing} onclick={submitDelete}>Delete</Button>
      </div>
    </Modal>
  {/if}
</Layout>