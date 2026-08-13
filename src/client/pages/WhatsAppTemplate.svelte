<script lang="ts">
  import { Link, useForm, usePage } from '@inertiajs/svelte'
  import Layout from '../components/Layout.svelte'
  import Card from '../components/Card.svelte'
  import Field from '../components/Field.svelte'
  import Input from '../components/Input.svelte'
  import Textarea from '../components/Textarea.svelte'
  import Button from '../components/Button.svelte'
  import Select from '../components/Select.svelte'
  import Switch from '../components/Switch.svelte'
  import type { WhatsAppTemplate } from '../../shared/types'

  let { template = null }: { template?: WhatsAppTemplate | null } = $props()

  const isEdit = $derived(Boolean(template))
  const page = usePage()
  const currentUser = $derived(page.props.auth.user)

  const form = $state(
    useForm({
      name: template?.name ?? '',
      slug: template?.slug ?? '',
      body: template?.body ?? '',
      mediaUrl: template?.mediaUrl ?? '',
      placeholders: template ? template.placeholders.join(', ') : '',
      trigger: template?.trigger ?? 'manual',
      recipient: template?.recipient ?? 'customer',
      enabled: template ? template.enabled : true,
    }),
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
      form.patch(`/whatsapp/templates/${template.id}`)
    } else {
      form.post('/whatsapp/templates')
    }
  }
</script>

<svelte:head><title>{isEdit && template ? `Edit ${template.name}` : 'New template'}</title></svelte:head>

{#if currentUser && currentUser.role === 'admin'}
  <Layout>
    <div class="mb-3">
      <Link href="/whatsapp" class="text-sm text-muted hover:text-text">← Back to WhatsApp</Link>
    </div>
    <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">
      {isEdit && template ? `Edit ${template.name}` : 'New template'}
    </h1>
    <p class="text-muted mb-3">
      Compose a reusable WhatsApp message. Use {'{{ token }}'} placeholders, e.g.
      Hi {'{{ name }}'}.
    </p>

    <Card class="p-6">
      <form onsubmit={submit} novalidate>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">

        <Field id="wt-name" label="Name" error={form.errors.name}>
          <Input id="wt-name" bind:value={form.name} onchange={() => form.clearErrors('name')} />
        </Field>
        <Field id="wt-slug" label="Slug" error={form.errors.slug}>
          <Input id="wt-slug" bind:value={form.slug} onchange={() => form.clearErrors('slug')} />
        </Field>
        </div>
        <Field id="wt-body" label="Body" error={form.errors.body}>
          <Textarea
            id="wt-body"
            rows={8}
            bind:value={form.body}
            hideLabel
            label=""
            oninput={() => form.clearErrors('body')}
          />
          <p class="text-xs text-muted mt-1">Supports {'{{ placeholder }}'} tokens.</p>
        </Field>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">

        <Field id="wt-media" label="Media URL (optional)" error={form.errors.mediaUrl}>
          <Input id="wt-media" bind:value={form.mediaUrl} onchange={() => form.clearErrors('mediaUrl')} />
          <p class="text-xs text-muted mt-1">
            Attachment link sent as Dripsender's media_url (image, file, audio).
          </p>
        </Field>
        <Field id="wt-ph" label="Placeholders" error={form.errors.placeholders}>
          <Input id="wt-ph" bind:value={form.placeholders} onchange={() => form.clearErrors('placeholders')} />
          <p class="text-xs text-muted mt-1">Comma-separated, e.g. name, phone, link</p>
        </Field>
        </div>  
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">

        <Field id="wt-trigger" label="Trigger">
          <Select id="wt-trigger" options={TRIGGER_OPTIONS} bind:value={form.trigger} />
          <p class="text-xs text-muted mt-1">When this message is sent automatically. "Manual" means only via the Test button.</p>
        </Field>
        <Field id="wt-recipient" label="Recipient">
          <Select id="wt-recipient" options={RECIPIENT_OPTIONS} bind:value={form.recipient} />
          <p class="text-xs text-muted mt-1">Customer = the person who triggered the event. Admin = the configured notification number.</p>
        </Field>
        </div>
        <Field id="wt-enabled" label="Enabled">
          <Switch bind:checked={form.enabled} label="Send automatically when the trigger fires" />
        </Field>
        <div class="flex items-center justify-end gap-2 mt-4">
          <Button href="/whatsapp" variant="ghost" type="button">Cancel</Button>
          <Button variant="primary" type="submit" loading={form.processing}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Card>
  </Layout>
{/if}
