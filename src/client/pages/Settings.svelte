<script lang="ts">
  import { router, useForm, usePage } from '@inertiajs/svelte'
  import { untrack } from 'svelte'
  import Layout from '../components/Layout.svelte'
  import Card from '../components/Card.svelte'
  import Tabs from '../components/Tabs.svelte'
  import Field from '../components/Field.svelte'
  import Input from '../components/Input.svelte'
  import Textarea from '../components/Textarea.svelte'
  import Select from '../components/Select.svelte'
  import Button from '../components/Button.svelte'
  import type { SettingsGroup, SettingsItem } from '../../shared/types'

  let { groups }: { groups: SettingsGroup[] } = $props()

  const page = usePage()
  const currentUser = $derived(page.props.auth.user)

  const initial = $derived(
    (() => {
      const map: Record<string, string> = {}
      for (const group of groups) {
        for (const item of group.items) map[item.key] = item.value
      }
      return map
    })(),
  )
  // Snapshot the server-provided values once — the form owns its state after
  // construction, so later prop changes (there are none for this page) must
  // not reset user edits.
  let form = $state(untrack(() => useForm(initial)))

  // Script tab collapses each tracking snippet (<script> textarea) into a
  // FAQ-style accordion so the long list stays scannable. Each field expands
  // independently; collapsed textareas keep their value in form state.
  let openScripts = $state<Set<string>>(new Set())
  function toggleScript(key: string) {
    const next = new Set(openScripts)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    openScripts = next
  }

  /** Parse the JSON-array WhatsApp value (falls back to a legacy plain value). */
  function parseNumbers(raw: string): string[] {
    try {
      const value = JSON.parse(raw) as unknown
      if (Array.isArray(value)) return value.map(String).filter((s) => s.trim() !== '')
    } catch {
      /* legacy single-value setting */
    }
    return raw.trim() ? [raw] : []
  }
  let whatsappNumbers = $state(untrack(() => parseNumbers(initial['contact.whatsapp'] ?? '')))

  function save(e?: SubmitEvent) {
    e?.preventDefault()
    form['contact.whatsapp'] = JSON.stringify(
      whatsappNumbers.map((n) => n.trim()).filter(Boolean),
    )
    form.post('/settings')
  }

  // ---- media (logo / favicon) uploads --------------------------------------
  // Uploads go through the media library (POST /media, Modul 8) so the file
  // is stored persistently with metadata; /settings/media only records the
  // media id as the setting value.
  let mediaTarget = $state('')
  let fileInputRef = $state<HTMLInputElement | null>(null)
  let uploadingKey = $state('')
  let uploadError = $state('')
  // Local preview of the just-selected file (object URL), keyed to the
  // media field being uploaded. Revoked once the upload settles.
  let previewKey = $state('')
  let previewUrl = $state('')

  function pickMedia(key: string) {
    mediaTarget = key
    uploadError = ''
    fileInputRef?.click()
  }

  function removeMedia(key: string) {
    form[key] = ''
    save()
  }

  async function onFile(e: Event) {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    target.value = '' // allow re-selecting the same file
    const key = mediaTarget
    if (!file || !key) return
    uploadingKey = key
    uploadError = ''
    // Show the locally selected image immediately (object URL), before
    // the upload completes. Non-image files skip the preview.
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    previewKey = key
    previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
    try {
      // 1. Store the file in the media library.
      const mediaRes = await fetch('/media', {
        method: 'POST',
        headers: {
          'x-file-name': file.name,
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      })
      if (!mediaRes.ok) {
        const body = (await mediaRes.json().catch(() => null)) as { error?: string } | null
        uploadError = body?.error ?? `Upload failed (HTTP ${mediaRes.status})`
        return
      }
      const { media } = (await mediaRes.json()) as { media: { id: number } }
      // 2. Point the setting at the stored media item.
      const res = await fetch('/settings/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, mediaId: media.id }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        uploadError = body?.error ?? `Link failed (HTTP ${res.status})`
        return
      }
      router.reload()
    } catch (err) {
      uploadError = err instanceof Error ? err.message : String(err)
    } finally {
      uploadingKey = ''
      // Upload settled (saved, failed, or aborted) — drop the local
      // preview; the field falls back to the saved value.
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      previewUrl = ''
      previewKey = ''
    }
}
</script>

<svelte:head><title>Settings</title></svelte:head>

{#if currentUser && currentUser.role === 'admin'}
  <Layout>
    <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">Settings</h1>
    <p class="text-muted mb-3">
      Application-wide configuration, grouped by category. Saved values are
      served through a cached settings store.
    </p>

    <input
      bind:this={fileInputRef}
      type="file"
      accept="image/*"
      hidden
      onchange={onFile}
    />

    <Card class="p-6">
      <Tabs tabs={groups.map((g) => ({ value: g.category, label: g.label }))}>
        {#snippet children(active)}
          {#each groups as group (group.category)}
            {#if group.category === active}
              <form onsubmit={save} novalidate>
                {#if group.category === 'script'}
                  <p class="text-muted text-sm mb-3">
                    Paste each analytics or ad snippet below. Expand a field to
                    edit it — all values save together when you press Save.
                  </p>
                  <div class="flex flex-col gap-2">
                    {#each group.items as item (item.key)}
                      {@const open = openScripts.has(item.key)}
                      <div class="border border-border rounded-lg overflow-hidden bg-surface">
                        <button
                          type="button"
                          class="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer transition-colors hover:bg-primary-soft"
                          aria-expanded={open}
                          onclick={() => toggleScript(item.key)}
                        >
                          <span class="font-medium text-sm text-text">{item.label}</span>
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
                            class={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>
                        {#if open}
                          <div class="px-4 pb-4 pt-1 border-t border-border">
                            <Textarea
                              id={`s-${item.key}`}
                              label={item.label}
                              hideLabel
                              rows={6}
                              hint={item.hint}
                              bind:value={form[item.key]}
                            />
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {:else}
                {#each group.items.filter((i) => i.kind !== 'media') as item (item.key)}
                  {#if item.kind === 'textarea'}
                    <Textarea
                      id={`s-${item.key}`}
                      label={item.label}
                      rows={6}
                      hint={item.hint}
                      bind:value={form[item.key]}
                    />
                  {:else if item.kind === 'select'}
                    <Field id={`s-${item.key}`} label={item.label}>
                      <Select
                        id={`s-${item.key}`}
                        options={item.options ?? []}
                        bind:value={form[item.key]}
                      />
                      {#if item.hint}
                        <p class="text-xs text-muted mt-1">{item.hint}</p>
                      {/if}
                    </Field>
                  {:else if item.kind === 'repeater'}
                    <Field id={`s-${item.key}`} label={item.label}>
                      {#if whatsappNumbers.length === 0}
                        <p class="text-muted text-sm mb-2">No numbers yet.</p>
                      {/if}
                      {#each whatsappNumbers as number, i (i)}
                        <div class="flex items-center gap-2 mb-2">
                          <Input
                            id={`s-${item.key}-${i}`}
                            placeholder="e.g. +6281234567890"
                            bind:value={whatsappNumbers[i]}
                          />
                          <Button
                            variant="secondary"
                            type="button"
                            aria-label="Remove number"
                            onclick={() => whatsappNumbers.splice(i, 1)}
                          >
                            Remove
                          </Button>
                        </div>
                      {/each}
                      <Button
                        variant="secondary"
                        type="button"
                        onclick={() => whatsappNumbers.push('')}
                      >
                        + Add number
                      </Button>
                      {#if item.hint}
                        <p class="text-xs text-muted mt-2">{item.hint}</p>
                      {/if}
                    </Field>
                  {:else}
                    <Field id={`s-${item.key}`} label={item.label}>
                      <Input id={`s-${item.key}`} bind:value={form[item.key]} />
                      {#if item.hint}
                        <p class="text-xs text-muted mt-1">{item.hint}</p>
                      {/if}
                    </Field>
                  {/if}
                {/each}
                {/if}

                {#snippet mediaField(item: SettingsItem)}
                  <Field id={`s-${item.key}`} label={item.label}>
                    <div class="flex flex-wrap items-center gap-3">
                      {#if previewKey === item.key && previewUrl}
                        <img
                          class={`${item.key === 'app.favicon' ? 'h-8 w-8' : 'h-10 max-w-[200px]'} object-contain ${uploadingKey === item.key ? 'opacity-60' : ''}`}
                          src={previewUrl}
                          alt={`${item.label} preview`}
                        />
                      {:else if form[item.key]}
                        <img
                          class={item.key === 'app.favicon' ? 'h-8 w-8 object-contain' : 'h-10 max-w-[200px] object-contain'}
                          src={form[item.key]}
                          alt={item.label}
                        />
                      {:else}
                        <span class="text-muted text-sm">No file uploaded yet.</span>
                      {/if}
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={uploadingKey !== ''}
                        onclick={() => pickMedia(item.key)}
                      >
                        {uploadingKey === item.key ? 'Uploading…' : 'Upload'}
                      </Button>
                      {#if form[item.key]}
                        <Button variant="ghost" type="button" onclick={() => removeMedia(item.key)}>
                          Remove
                        </Button>
                      {/if}
                    </div>
                    {#if item.hint}
                      <p class="text-xs text-muted mt-1">{item.hint}</p>
                    {/if}
                    {#if uploadError && uploadingKey === ''}
                      <p class="text-danger-fg text-xs mt-2" role="alert">{uploadError}</p>
                    {/if}
                  </Field>
                {/snippet}

                {#if group.items.some((i) => i.kind === 'media')}
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                    {#each group.items.filter((i) => i.kind === 'media') as item (item.key)}
                      {@render mediaField(item)}
                    {/each}
                  </div>
                {/if}

                <div class="flex items-center justify-end gap-2 mt-4">
                  <Button variant="primary" type="submit" loading={form.processing}>
                    Save
                  </Button>
                </div>
              </form>
            {/if}
          {/each}
        {/snippet}
      </Tabs>
    </Card>
  </Layout>
{/if}
