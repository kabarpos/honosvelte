<script lang="ts">
  import { Link, useForm } from '@inertiajs/svelte'
  import { can } from '../capabilities'
  import { untrack } from 'svelte'
  import Layout from '../components/Layout.svelte'
  import Card from '../components/Card.svelte'
  import Field from '../components/Field.svelte'
  import Input from '../components/Input.svelte'
  import Textarea from '../components/Textarea.svelte'
  import Button from '../components/Button.svelte'
  import Select from '../components/Select.svelte'
  import Switch from '../components/Switch.svelte'
  import type { EmailTemplate } from '../../shared/types'

  let { template = null }: { template?: EmailTemplate | null } = $props()

  const isEdit = $derived(Boolean(template))

  const form = $state(
    untrack(() =>
      useForm({
        name: template?.name ?? '',
        slug: template?.slug ?? '',
        subject: template?.subject ?? '',
        body: template?.body ?? '',
        placeholders: template ? template.placeholders.join(', ') : '',
        trigger: template?.trigger ?? 'manual',
        recipient: template?.recipient ?? 'customer',
        enabled: template ? template.enabled : true,
      }),
    ),
  )

  const TRIGGER_OPTIONS = [
    { value: 'manual', label: 'Manual (no auto-send)' },
    { value: 'on_register', label: 'On registration' },
    { value: 'on_contact', label: 'On contact form submit' },
    { value: 'on_order', label: 'On order (coming soon)' },
  ]
  const RECIPIENT_OPTIONS = [
    { value: 'customer', label: 'Customer' },
    { value: 'admin', label: 'Admin' },
  ]

  function submit(e: SubmitEvent) {
    e.preventDefault()
    if (isEdit && template) {
      form.patch(`/email/templates/${template.id}`)
    } else {
      form.post('/email/templates')
    }
  }
</script>

<svelte:head><title>{isEdit && template ? `Edit ${template.name}` : 'New template'}</title></svelte:head>

{#if can('email.read')}
  <Layout>
    <div class="mb-3">
      <Link href="/email" class="text-sm text-muted hover:text-text">← Back to email</Link>
    </div>
    <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">
      {isEdit && template ? `Edit ${template.name}` : 'New template'}
    </h1>
    <p class="text-muted mb-3">
      Compose a reusable email. Use {'{{ token }}'} placeholders, e.g. Hello {'{{ name }}'}.
    </p>

    <Card class="p-6">
      <form onsubmit={submit} novalidate>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field id="et-name" label="Name" error={form.errors.name}>
          <Input id="et-name" bind:value={form.name} onchange={() => form.clearErrors('name')} />
        </Field>
        <Field id="et-slug" label="Slug" error={form.errors.slug}>
          <Input id="et-slug" bind:value={form.slug} onchange={() => form.clearErrors('slug')} />
        </Field>
        </div>
        <Field id="et-subject" label="Subject" error={form.errors.subject}>
          <Input id="et-subject" bind:value={form.subject} onchange={() => form.clearErrors('subject')} />
        </Field>
        <Field id="et-body" label="Body" error={form.errors.body}>
          <Textarea
            id="et-body"
            rows={8}
            bind:value={form.body}
            hideLabel
            label=""
            oninput={() => form.clearErrors('body')}
          />
          <p class="text-xs text-muted mt-1">Supports {'{{ placeholder }}'} tokens.</p>
        </Field>
        <Field id="et-ph" label="Placeholders" error={form.errors.placeholders}>
          <Input id="et-ph" bind:value={form.placeholders} onchange={() => form.clearErrors('placeholders')} />
          <p class="text-xs text-muted mt-1">Comma-separated, e.g. name, email, link</p>
        </Field>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field id="et-trigger" label="Trigger">
          <Select id="et-trigger" options={TRIGGER_OPTIONS} bind:value={form.trigger} />
          <p class="text-xs text-muted mt-1">When this email is sent automatically. "Manual" means only via the Test button.</p>
        </Field>
        <Field id="et-recipient" label="Recipient">
          <Select id="et-recipient" options={RECIPIENT_OPTIONS} bind:value={form.recipient} />
          <p class="text-xs text-muted mt-1">Customer = the person who triggered the event. Admin = the configured notification address.</p>
        </Field>
        </div>
        <Field id="et-enabled" label="Enabled">
          <Switch bind:checked={form.enabled} label="Send automatically when the trigger fires" />
        </Field>
        <div class="flex items-center justify-end gap-2 mt-4">
          <Button href="/email" variant="ghost" type="button">Cancel</Button>
          <Button variant="primary" type="submit" loading={form.processing}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Card>
  </Layout>
{/if}
