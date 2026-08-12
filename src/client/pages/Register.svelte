<script lang="ts">
  import { Link, useForm } from '@inertiajs/svelte'
  import AuthLayout from '../components/AuthLayout.svelte'
  import Button from '../components/Button.svelte'
  import Alert from '../components/Alert.svelte'
  import TextField from '../components/TextField.svelte'

  let { googleEnabled = false }: { googleEnabled?: boolean } = $props()

  const form = useForm({ name: '', email: '', password: '', whatsapp: '' })

  function submit(e: SubmitEvent) {
    e.preventDefault()
    form.post('/register')
  }
</script>

<svelte:head><title>Register</title></svelte:head>

<AuthLayout>
  <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">Create your account</h1>
  <p class="text-muted mb-5">Start building with the boilerplate in seconds.</p>

  {#if googleEnabled}
    <Button href="/auth/google" variant="secondary" fullWidth>
      Register with Google
    </Button>
    <div class="flex items-center gap-3 text-muted text-xs my-5">
      <span class="flex-1 h-px bg-border"></span>
      or
      <span class="flex-1 h-px bg-border"></span>
    </div>
  {/if}

  <form onsubmit={submit} novalidate>
    <TextField
      id="name"
      label="Name"
      error={form.errors.name}
      type="text"
      name="name"
      autocomplete="name"
      autofocus
      bind:value={form.name}
      onchange={() => form.clearErrors('name')}
    />

    <TextField
      id="email"
      label="Email"
      error={form.errors.email}
      type="email"
      name="email"
      autocomplete="email"
      bind:value={form.email}
      onchange={() => form.clearErrors('email')}
    />

    <TextField
      id="password"
      label="Password"
      error={form.errors.password}
      type="password"
      name="password"
      autocomplete="new-password"
      hint="At least 8 characters."
      bind:value={form.password}
      onchange={() => form.clearErrors('password')}
    />

    <TextField
      id="whatsapp"
      label="WhatsApp (optional)"
      error={form.errors.whatsapp}
      type="tel"
      name="whatsapp"
      autocomplete="tel"
      placeholder="+62 812 3456 7890"
      bind:value={form.whatsapp}
      onchange={() => form.clearErrors('whatsapp')}
    />

    <Button type="submit" fullWidth loading={form.processing}>
      {form.processing ? 'Creating account…' : 'Create account'}
    </Button>
  </form>

  <p class="mt-5 text-center text-muted text-sm">
    Already have an account? <Link href="/login">Log in</Link>
  </p>
</AuthLayout>
