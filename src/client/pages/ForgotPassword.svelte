<script lang="ts">
  import { Link, useForm } from '@inertiajs/svelte'
  import AuthLayout from '../components/AuthLayout.svelte'
  import Button from '../components/Button.svelte'
  import Alert from '../components/Alert.svelte'
  import TextField from '../components/TextField.svelte'

  let { status = undefined }: { status?: string } = $props()

  const form = useForm({ email: '' })

  function submit(e: SubmitEvent) {
    e.preventDefault()
    form.post('/forgot-password')
  }
</script>

<svelte:head><title>Forgot password</title></svelte:head>

<AuthLayout>
  <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">Reset your password</h1>
  <p class="text-muted mb-5">Enter your email and we will send you a reset link.</p>

  {#if status === 'sent'}
    <Alert variant="success" class="mb-5">
      If that email is registered, a reset link has been sent. Check your inbox.
    </Alert>
  {/if}

  <form onsubmit={submit} novalidate>
    <TextField
      id="email"
      label="Email"
      error={form.errors.email}
      type="email"
      name="email"
      autocomplete="email"
      autofocus
      bind:value={form.email}
      onchange={() => form.clearErrors('email')}
    />

    <Button type="submit" fullWidth loading={form.processing}>
      {form.processing ? 'Sending…' : 'Send reset link'}
    </Button>
  </form>

  <p class="mt-5 text-center text-muted text-sm">
    Remembered it? <Link href="/login">Back to login</Link>
  </p>
</AuthLayout>
