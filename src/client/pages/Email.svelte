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
  import type { EmailTemplate } from '../../shared/types'

  let {
    mail,
    templates,
    adminNotifyAddress,
  }: { mail: { driver: string; from: string; smtpHost: string; smtpPort: string; smtpUser: string; smtpSecure: string }; templates: EmailTemplate[]; adminNotifyAddress: string } = $props()

  const page = usePage()
  const currentUser = $derived(page.props.auth.user)

  let activeTab = $state('config')

  // --- Configuration: editable SMTP settings (saved via POST /email/config) -
  let mailForm = $state({
    driver: mail.driver,
    from: mail.from,
    smtp_host: mail.smtpHost,
    smtp_port: mail.smtpPort,
    smtp_user: mail.smtpUser,
    smtp_pass: '',
    smtp_secure: mail.smtpSecure,
    admin_notify_address: adminNotifyAddress,
  })
  let mailStatus = $state<{ ok: boolean; message: string } | null>(null)
  let savingMail = $state(false)

  const MAIL_DRIVER_OPTIONS = [
    { value: 'smtp', label: 'SMTP' },
    { value: 'log', label: 'Log (dev)' },
    { value: 'resend', label: 'Resend' },
    { value: 'mailtrap', label: 'Mailtrap' },
  ]
  const MAIL_SECURE_OPTIONS = [
    { value: 'false', label: 'No — STARTTLS (port 587)' },
    { value: 'true', label: 'Yes — implicit TLS (port 465)' },
  ]

  async function saveMailConfig(e?: SubmitEvent) {
    e?.preventDefault()
    savingMail = true
    mailStatus = null
    try {
      const res = await fetch('/email/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          driver: mailForm.driver,
          from: mailForm.from,
          smtp_host: mailForm.smtp_host,
          smtp_port: mailForm.smtp_port,
          smtp_user: mailForm.smtp_user,
          smtp_pass: mailForm.smtp_pass,
          smtp_secure: mailForm.smtp_secure,
          admin_notify_address: mailForm.admin_notify_address,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
      }
      if (res.ok && data.ok) {
        mailStatus = { ok: true, message: 'Mail configuration saved.' }
        mailForm.smtp_pass = '' // don't keep the secret in the field
      } else {
        mailStatus = { ok: false, message: data.error ?? 'Save failed.' }
      }
    } finally {
      savingMail = false
    }
  }

  // --- Configuration: provider info + one-off test send -------------------
  let testCfg = $state({ to: '', subject: '', body: '' })
  let testStatus = $state<{ ok: boolean; message: string } | null>(null)

  async function sendTest() {
    testStatus = null
    const res = await fetch('/email/test', {
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
        data.error ?? (res.ok ? `Test email sent to ${testCfg.to}.` : 'Send failed.'),
    }
  }

  // --- Template actions: preview / test / delete (create & edit are pages) ---
  let deleteTpl = $state<EmailTemplate | null>(null)
  let deleteOpen = $state(false)
  let deleteForm = $state(useForm({}))

  function submitDelete(e: SubmitEvent) {
    e.preventDefault()
    if (!deleteTpl) return
    deleteForm.delete(`/email/templates/${deleteTpl.id}`, {
      onSuccess: () => {
        deleteOpen = false
        deleteTpl = null
      },
    })
  }

  // --- Preview / test a template (fetch-driven) --------------------------
  let previewTpl = $state<EmailTemplate | null>(null)
  let previewData = $state<{ subject: string; body: string } | null>(null)
  let previewOpen = $state(false)

  let testTpl = $state<EmailTemplate | null>(null)
  let testTo = $state('')
  let testStatus2 = $state<{ ok: boolean; message: string } | null>(null)
  let testOpen = $state(false)

  async function openPreview(t: EmailTemplate) {
    const res = await fetch(`/email/templates/${t.id}/preview`)
    if (!res.ok) return
    previewData = (await res.json()) as { subject: string; body: string }
    previewTpl = t
    previewOpen = true
  }

  function openTest(t: EmailTemplate) {
    testTpl = t
    testTo = ''
    testStatus2 = null
    testOpen = true
  }

  async function sendTemplateTest() {
    if (!testTpl) return
    testStatus2 = null
    const res = await fetch(`/email/templates/${testTpl.id}/test`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to: testTo }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
    }
    testStatus2 = {
      ok: res.ok && Boolean(data.ok),
      message:
        data.error ?? (res.ok ? `Template sent to ${testTo}.` : 'Send failed.'),
    }
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

<svelte:head><title>Email</title></svelte:head>

{#if currentUser && currentUser.role === 'admin'}
  <Layout>
    <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">Email</h1>
    <p class="text-muted mb-3">
      Configure the mail provider and manage reusable email templates.
    </p>

    <Card class="p-6">
      <Tabs tabs={[{ value: 'config', label: 'Configuration' }, { value: 'templates', label: 'Templates' }]} bind:value={activeTab}>
        {#snippet children(tab)}
          {#if tab === 'config'}
            <form onsubmit={saveMailConfig} novalidate class="flex flex-col gap-3 mb-8">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field id="mc-driver" label="Mail driver">
                  <Select id="mc-driver" options={MAIL_DRIVER_OPTIONS} bind:value={mailForm.driver} />
                </Field>
                <Field id="mc-secure" label="Use implicit TLS">
                  <Select id="mc-secure" options={MAIL_SECURE_OPTIONS} bind:value={mailForm.smtp_secure} />
                </Field>
              </div>
              <Field id="mc-from" label="From address">
                <Input id="mc-from" placeholder="no-reply@example.com" bind:value={mailForm.from} />
              </Field>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field id="mc-host" label="SMTP host">
                  <Input id="mc-host" placeholder="smtp.example.com" bind:value={mailForm.smtp_host} />
                </Field>
                <Field id="mc-port" label="SMTP port">
                  <Input id="mc-port" placeholder="465 or 587" bind:value={mailForm.smtp_port} />
                </Field>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field id="mc-user" label="SMTP username">
                  <Input id="mc-user" bind:value={mailForm.smtp_user} />
                </Field>
                <Field id="mc-pass" label="SMTP password">
                  <Input id="mc-pass" type="password" autocomplete="new-password" bind:value={mailForm.smtp_pass} />
                  <p class="text-xs text-muted mt-1">Leave blank to keep the current password.</p>
                </Field>
              </div>
              <Field id="mc-admin" label="Admin notification address">
                <Input id="mc-admin" type="email" placeholder="admin@example.com" bind:value={mailForm.admin_notify_address} />
                <p class="text-xs text-muted mt-1">Address that receives templates triggered for "Admin" (e.g. new contact messages). Leave blank to disable admin delivery.</p>
              </Field>
              {#if mailStatus}
                <Alert variant={mailStatus.ok ? 'success' : 'error'}>{mailStatus.message}</Alert>
              {/if}
              <div class="flex items-center justify-end">
                <Button type="submit" variant="primary" loading={savingMail}>Save configuration</Button>
              </div>
            </form>

            <hr class="border-border mb-6" />

            <p class="text-xs text-muted mb-4">
              Send a one-off test message through the active driver to verify the
              configuration above.
            </p>

            <form
              onsubmit={(e) => {
                e.preventDefault()
                sendTest()
              }}
              novalidate
              class="flex flex-col gap-3"
            >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field id="ct-to" label="Recipient" error={testStatus && !testStatus.ok && !testCfg.to ? 'Recipient is required.' : undefined}>
                <Input id="ct-to" type="email" placeholder="you@company.com" bind:value={testCfg.to} />
              </Field>
              <Field id="ct-subject" label="Subject">
                <Input id="ct-subject" placeholder="Test email" bind:value={testCfg.subject} />
              </Field></div>
              <Field id="ct-body" label="Message">
                <Textarea id="ct-body" rows={4} placeholder="Your test message…" bind:value={testCfg.body} hideLabel label="" />
              </Field>
              {#if testStatus}
                <Alert variant={testStatus.ok ? 'success' : 'error'}>{testStatus.message}</Alert>
              {/if}
              <div class="flex items-center justify-end">
                <Button type="submit" variant="primary">Send test email</Button>
              </div>
            </form>
          {:else}
            <div class="flex items-start justify-between gap-4 mb-3">
              <p class="text-muted mb-0">
                {templates.length} template{templates.length === 1 ? '' : 's'} available
                for notifications and onboarding.
              </p>
              <Button href="/email/templates/create">Add template</Button>
            </div>

            <div class="rounded-card border border-border overflow-hidden">
              <Table>
                <thead>
                  <tr>
                    <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">Name</th>
                    <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">Slug</th>
                    <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">Trigger</th>
                    <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">Subject</th>
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
                      <td class="text-left px-3 py-2.5 border-b border-border">{t.subject}</td>
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
                            { label: 'Edit', onClick: () => router.visit(`/email/templates/${t.id}/edit`) },
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
                      <td colspan={6} class="text-center text-muted p-6">No templates yet.</td>
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
          <p class="text-xs uppercase tracking-wider text-muted mb-1">Subject</p>
          <p class="mt-0 mb-3 font-medium">{previewData.subject}</p>
          <p class="text-xs uppercase tracking-wider text-muted mb-1">Body</p>
          <div class="whitespace-pre-wrap rounded-card border border-border bg-bg p-4 text-sm">{previewData.body}</div>
        {/if}
        <div class="flex items-center justify-end mt-4">
          <Button variant="ghost" type="button" onclick={() => (previewOpen = false)}>Close</Button>
        </div>
      </Modal>
    {/if}

    <!-- Test-send template -->
    {#if testTpl}
      <Modal open={testOpen} title={`Test send — ${testTpl.name}`} size="md">
        <Field id="tt-to" label="Send to" error={testStatus2 && !testStatus2.ok && !testTo ? 'Recipient is required.' : undefined}>
          <Input id="tt-to" type="email" placeholder="you@company.com" bind:value={testTo} />
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
