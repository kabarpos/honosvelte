<script lang="ts">
  import { Link, router, useForm, usePage } from '@inertiajs/svelte'
  import Layout from '../components/Layout.svelte'
  import Card from '../components/Card.svelte'
  import Tabs from '../components/Tabs.svelte'
  import Table from '../components/Table.svelte'
  import Field from '../components/Field.svelte'
  import Input from '../components/Input.svelte'
  import Textarea from '../components/Textarea.svelte'
  import Button from '../components/Button.svelte'
  import Modal from '../components/Modal.svelte'
  import RowActions from '../components/RowActions.svelte'
  import Alert from '../components/Alert.svelte'
  import Badge from '../components/Badge.svelte'
  import Select from '../components/Select.svelte'
  import type { WhatsAppTemplate } from '../../shared/types'

  let {
    whatsapp,
    templates,
    webhookUrl,
  }: { whatsapp: { provider: string; hasApiKey: boolean; adminNotifyNumber: string; integrationUrl: string }; templates: WhatsAppTemplate[]; webhookUrl: string } =
    $props()

  const page = usePage()
  const currentUser = $derived(page.props.auth.user)

  let activeTab = $state('config')

  // --- Configuration: provider + API key (saved via POST /whatsapp/config) --
  let cfgForm = $state({
    provider: whatsapp.provider,
    api_key: '',
    integration_url: whatsapp.integrationUrl,
    admin_notify_number: whatsapp.adminNotifyNumber,
  })
  let cfgStatus = $state<{ ok: boolean; message: string } | null>(null)
  let savingCfg = $state(false)
  const PROVIDER_OPTIONS = [
    { value: 'dripsender', label: 'Dripsender.id' },
    { value: 'log', label: 'Log (dev)' },
  ]

  async function saveConfig(e?: SubmitEvent) {
    e?.preventDefault()
    savingCfg = true
    cfgStatus = null
    try {
      const res = await fetch('/whatsapp/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: cfgForm.provider,
          api_key: cfgForm.api_key,
          integration_url: cfgForm.integration_url,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
      }
      if (res.ok && data.ok) {
        cfgStatus = { ok: true, message: 'WhatsApp configuration saved.' }
        // Keep the (possibly new) key visible in the field.
      } else {
        cfgStatus = { ok: false, message: data.error ?? 'Save failed.' }
      }
    } finally {
      savingCfg = false
    }
  }

  // --- Test send: a one-off WhatsApp through the active provider ----------
  let testCfg = $state({ phone: '', text: '', mediaUrl: '' })
  let testStatus = $state<{ ok: boolean; message: string } | null>(null)

  async function sendTest() {
    testStatus = null
    const res = await fetch('/whatsapp/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(testCfg),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
    }
    testStatus = {
      ok: res.ok && Boolean(data.ok),
      message:
        data.error ?? (res.ok ? `Test message sent to ${testCfg.phone}.` : 'Send failed.'),
    }
  }

  // --- Template actions: preview / test / delete (create & edit are pages) ---
  let deleteTpl = $state<WhatsAppTemplate | null>(null)
  let deleteOpen = $state(false)
  let deleteForm = $state(useForm({}))

  function submitDelete(e: SubmitEvent) {
    e.preventDefault()
    if (!deleteTpl) return
    deleteForm.delete(`/whatsapp/templates/${deleteTpl.id}`, {
      onSuccess: () => {
        deleteOpen = false
        deleteTpl = null
      },
    })
  }

  // --- Preview / test a template (fetch-driven) --------------------------
  let previewTpl = $state<WhatsAppTemplate | null>(null)
  let previewData = $state<{ body: string; mediaUrl: string } | null>(null)
  let previewOpen = $state(false)

  let testTpl = $state<WhatsAppTemplate | null>(null)
  let testPhone = $state('')
  let testStatus2 = $state<{ ok: boolean; message: string } | null>(null)
  let testOpen = $state(false)

  async function openPreview(t: WhatsAppTemplate) {
    const res = await fetch(`/whatsapp/templates/${t.id}/preview`)
    if (!res.ok) return
    previewData = (await res.json()) as { body: string; mediaUrl: string }
    previewTpl = t
    previewOpen = true
  }

  function openTest(t: WhatsAppTemplate) {
    testTpl = t
    testPhone = ''
    testStatus2 = null
    testOpen = true
  }

  async function sendTemplateTest() {
    if (!testTpl) return
    testStatus2 = null
    const res = await fetch(`/whatsapp/templates/${testTpl.id}/test`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: testPhone }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
    }
    testStatus2 = {
      ok: res.ok && Boolean(data.ok),
      message:
        data.error ?? (res.ok ? `Template sent to ${testPhone}.` : 'Send failed.'),
    }
  }

  function truncate(s: string, n = 80): string {
    return s.length > n ? `${s.slice(0, n)}…` : s
  }

  function triggerLabel(t: string): string {
    const m: Record<string, string> = {
      manual: 'Manual',
      on_register: 'On register',
      on_contact: 'On contact',
      on_order: 'On order',
    }
    return m[t] ?? t
  }
</script>

<svelte:head><title>WhatsApp</title></svelte:head>

{#if currentUser && currentUser.role === 'admin'}
  <Layout>
    <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">WhatsApp</h1>
    <p class="text-muted mb-3">
      Configure the Dripsender provider and manage reusable WhatsApp templates.
    </p>

    <Card class="p-6">
      <Tabs
        tabs={[{ value: 'config', label: 'Configuration' }, { value: 'templates', label: 'Templates' }]}
        bind:value={activeTab}
      >
        {#snippet children(tab)}
          {#if tab === 'config'}
            <form onsubmit={saveConfig} novalidate class="flex flex-col gap-3 mb-8">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field id="wc-provider" label="Provider">
                  <Select id="wc-provider" options={PROVIDER_OPTIONS} bind:value={cfgForm.provider} />
                </Field>
                <Field id="wc-key" label="API key">
                  <div class="relative">
                    <Input
                      id="wc-key"
                      type="password"
                      autocomplete="new-password"
                      placeholder={whatsapp.hasApiKey ? 'Leave blank to keep existing key' : 'Enter API key'}
                      bind:value={cfgForm.api_key}
                    />
                  </div>
                  <p class="text-xs text-muted mt-1">
                    {whatsapp.hasApiKey
                      ? 'A key is configured. Type a new one to replace it, or leave blank to keep it.'
                      : 'Get it from the Dripsender dashboard. Leave blank to keep the current key.'}
                  </p>
                </Field>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3"> 
              <Field id="wc-integration" label="Integration webhook URL">
                <Input id="wc-integration" placeholder="https://….dripsender.id:14942/api/integration/…" bind:value={cfgForm.integration_url} />
                <p class="text-xs text-muted mt-1">Dripsender integration endpoint. New contacts (name + phone) captured on registration are pushed here. Leave blank to disable.</p>
              </Field>
              <Field id="wc-admin" label="Admin notification number">
                <Input id="wc-admin" placeholder="62813…" bind:value={cfgForm.admin_notify_number} />
                <p class="text-xs text-muted mt-1">WhatsApp number that receives templates triggered for "Admin" (e.g. new contact messages). Leave blank to disable admin delivery.</p>
              </Field></div>
              {#if cfgStatus}
                <Alert variant={cfgStatus.ok ? 'success' : 'error'}>{cfgStatus.message}</Alert>
              {/if}
              <div class="flex items-center justify-end">
                <Button type="submit" variant="primary" loading={savingCfg}>Save configuration</Button>
              </div>
            </form>

            <hr class="border-border mb-6" />

            <p class="text-xs text-muted mb-4">
              Send a one-off test message through the active provider to verify the
              configuration above.
            </p>

            <form
              onsubmit={(e) => {
                e.preventDefault()
                sendTest()
              }}
              novalidate
              class="flex flex-col gap-3 "
            >

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3"> 

              <Field
                id="ct-phone"
                label="Recipient phone"
                error={testStatus && !testStatus.ok && !testCfg.phone ? 'Recipient phone is required.' : undefined}
              >
                <Input id="ct-phone" placeholder="6281399999999" bind:value={testCfg.phone} />
              </Field>
              <Field id="ct-media" label="Media URL (optional)">
                <Input id="ct-media" placeholder="https://…/image.png" bind:value={testCfg.mediaUrl} />
              </Field>
              </div>
              <Field id="ct-text" label="Message">
                <Textarea id="ct-text" rows={4} placeholder="Your test message…" bind:value={testCfg.text} hideLabel label="" />
              </Field>
              
              {#if testStatus}
                <Alert variant={testStatus.ok ? 'success' : 'error'}>{testStatus.message}</Alert>
              {/if}
              <div class="flex items-center justify-end">
                <Button type="submit" variant="primary">Send test message</Button>
              </div>
            </form>

            <hr class="border-border my-6" />

            <div class="flex flex-col gap-1">
              <p class="text-sm font-medium mb-1">Inbound webhook</p>
              <p class="text-xs text-muted mb-2">
                Point Dripsender's Bot webhook at this URL to receive messages:
              </p>
              <code class="block rounded-card border border-border bg-bg px-3 py-2 text-xs break-all">{webhookUrl}</code>
            </div>
          {:else}
            <div class="flex items-start justify-between gap-4 mb-3">
              <p class="text-muted mb-0">
                {templates.length} template{templates.length === 1 ? '' : 's'} available
                for notifications and broadcasts.
              </p>
              <Button href="/whatsapp/templates/create">Add template</Button>
            </div>

            <div class="rounded-card border border-border overflow-hidden">
              <Table>
                <thead>
                  <tr>
                    <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">Name</th>
                    <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">Slug</th>
                    <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">Trigger</th>
                    <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">Body</th>
                    <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">Placeholders</th>
                    <th class="text-right px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">Actions</th>
                  </tr>
                </thead>
                <tbody class="[&>tr:last-child>td]:border-b-0">
                  {#each templates as t (t.id)}
                    <tr class="transition-colors hover:bg-primary-soft">
                      <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap font-medium">{t.name}</td>
                      <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap"><code class="text-xs bg-bg border border-border rounded px-1.5 py-0.5">{t.slug}</code></td>
                      <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
                        {#if t.trigger === 'manual'}
                          <Badge variant="neutral">Manual</Badge>
                        {:else}
                          <Badge variant="primary">{triggerLabel(t.trigger)}</Badge>
                          <span class="text-xs text-muted">→ {t.recipient === 'admin' ? 'Admin' : 'Customer'}{t.enabled ? '' : ' (off)'}</span>
                        {/if}
                      </td>
                      <td class="text-left px-3 py-2.5 border-b border-border max-w-[280px]"><span class="line-clamp-2">{truncate(t.body)}</span></td>
                      <td class="text-left px-3 py-2.5 border-b border-border text-muted">
                        {#if t.placeholders.length}
                          <div class="flex flex-wrap gap-1">
                            {#each t.placeholders as p (p)}<Badge variant="neutral">{p}</Badge>{/each}
                          </div>
                        {:else}—{/if}
                      </td>
                      <td class="text-right px-3 py-2.5 border-b border-border whitespace-nowrap">
                        <RowActions
                          items={[
                            { label: 'Preview', onClick: () => openPreview(t) },
                            { label: 'Test send', onClick: () => openTest(t) },
                            { label: 'Edit', onClick: () => router.visit(`/whatsapp/templates/${t.id}/edit`) },
                            {
                              label: 'Delete',
                              danger: true,
                              onClick: () => {
                                deleteTpl = t
                                deleteOpen = true
                              },
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  {/each}
                  {#if templates.length === 0}
                    <tr>
                      <td colspan={5} class="text-center text-muted p-6">No templates yet.</td>
                    </tr>
                  {/if}
                </tbody>
              </Table>
            </div>
          {/if}
        {/snippet}
      </Tabs>
    </Card>

    <!-- Preview template -->
    {#if previewTpl}
      <Modal open={previewOpen} title={`Preview — ${previewTpl.name}`} size="lg">
        {#if previewData}
          <p class="text-xs uppercase tracking-wider text-muted mb-1">Body</p>
          <div class="whitespace-pre-wrap rounded-card border border-border bg-bg p-4 text-sm">{previewData.body}</div>
          {#if previewData.mediaUrl}
            <p class="text-xs uppercase tracking-wider text-muted mb-1 mt-3">Media</p>
            <code class="block rounded-card border border-border bg-bg px-3 py-2 text-xs break-all">{previewData.mediaUrl}</code>
          {/if}
        {/if}
        <div class="flex items-center justify-end mt-4">
          <Button variant="ghost" type="button" onclick={() => (previewOpen = false)}>Close</Button>
        </div>
      </Modal>
    {/if}

    <!-- Test-send template -->
    {#if testTpl}
      <Modal open={testOpen} title={`Test send — ${testTpl.name}`} size="md">
        <Field
          id="tt-phone"
          label="Send to"
          error={testStatus2 && !testStatus2.ok && !testPhone ? 'Recipient phone is required.' : undefined}
        >
          <Input id="tt-phone" placeholder="6281399999999" bind:value={testPhone} />
        </Field>
        {#if testStatus2}
          <Alert variant={testStatus2.ok ? 'success' : 'error'}>{testStatus2.message}</Alert>
        {/if}
        <div class="flex items-center justify-end gap-2 mt-4">
          <Button variant="ghost" type="button" onclick={() => (testOpen = false)}>Cancel</Button>
          <Button variant="primary" type="button" onclick={sendTemplateTest}>Send</Button>
        </div>
      </Modal>
    {/if}

    <!-- Delete confirm -->
    {#if deleteTpl}
      <Modal open={deleteOpen} title="Delete template" size="sm">
        <p>Delete <strong>{deleteTpl.name}</strong>? This cannot be undone.</p>
        <div class="flex items-center justify-end gap-2 mt-4">
          <Button variant="ghost" type="button" onclick={() => (deleteOpen = false)}>Cancel</Button>
          <Button variant="danger" type="button" loading={deleteForm.processing} onclick={submitDelete}>Delete</Button>
        </div>
      </Modal>
    {/if}
  </Layout>
{/if}
