<script lang="ts">
  import { useForm, usePage } from '@inertiajs/svelte'
  import PublicLayout from '../components/PublicLayout.svelte'
  import Card from '../components/Card.svelte'
  import Button from '../components/Button.svelte'
  import Field from '../components/Field.svelte'
  import Input from '../components/Input.svelte'
  import Textarea from '../components/Textarea.svelte'
  import Alert from '../components/Alert.svelte'

  let { sent = false }: { sent?: boolean } = $props()

  const page = usePage()
  const settings = $derived(page.props.settings ?? {})
  const appName = $derived(settings['app.name'] || 'Honosvelte')

  const form = useForm({
    name: '',
    email: '',
    subject: '',
    message: '',
  })

  function submit(e: SubmitEvent) {
    e.preventDefault()
    form.post('/contact')
  }
</script>

<svelte:head><title>Contact — {appName}</title></svelte:head>

<PublicLayout>
  <section class="mx-auto max-w-[760px] px-5 py-16 max-md:px-4">
    <div class="mb-8">
      <h1 class="text-[2.2rem] font-bold tracking-tight m-0 mb-2">Get in touch</h1>
      <p class="text-muted m-0">
        Have a question or a project in mind? Send us a message and we'll get back
        to you within one business day.
      </p>
    </div>

    {#if sent}
      <Alert variant="success" class="mb-6">
        Thanks — your message has been sent. We'll be in touch soon.
      </Alert>
    {/if}

    <Card class="p-6 md:p-8">
      <form onsubmit={submit} novalidate>
        <Field id="name" label="Name" error={form.errors.name}>
          <Input
            id="name"
            placeholder="Your name"
            autocomplete="name"
            bind:value={form.name}
            error={Boolean(form.errors.name)}
            oninput={() => form.clearErrors('name')}
          />
        </Field>

        <Field id="email" label="Email" error={form.errors.email}>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autocomplete="email"
            bind:value={form.email}
            error={Boolean(form.errors.email)}
            oninput={() => form.clearErrors('email')}
          />
        </Field>

        <Field id="subject" label="Subject (optional)" error={form.errors.subject}>
          <Input
            id="subject"
            placeholder="What is this about?"
            bind:value={form.subject}
            error={Boolean(form.errors.subject)}
            oninput={() => form.clearErrors('subject')}
          />
        </Field>

        <Field id="message" label="Message" error={form.errors.message}>
          <Textarea
            id="message"
            label=""
            hideLabel
            rows={6}
            placeholder="Tell us a bit about your project…"
            bind:value={form.message}
            error={form.errors.message}
            oninput={() => form.clearErrors('message')}
          />
        </Field>

        <div class="flex items-center justify-end mt-2">
          <Button type="submit" variant="primary" loading={form.processing}>
            {form.processing ? 'Sending…' : 'Send message'}
          </Button>
        </div>
      </form>
    </Card>

    {#if settings['contact.email'] || settings['contact.address']}
      <div class="mt-6 text-sm text-muted flex flex-wrap gap-x-6 gap-y-1">
        {#if settings['contact.email']}
          <span>Email: <a class="hover:text-text" href={`mailto:${settings['contact.email']}`}>{settings['contact.email']}</a></span>
        {/if}
        {#if settings['contact.address']}
          <span>Address: {settings['contact.address']}</span>
        {/if}
      </div>
    {/if}
  </section>
</PublicLayout>
