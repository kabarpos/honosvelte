<script lang="ts">
  import { Link, useForm } from '@inertiajs/svelte'
  import AuthLayout from '../components/AuthLayout.svelte'
  import Button from '../components/Button.svelte'
  import Alert from '../components/Alert.svelte'
  import TextField from '../components/TextField.svelte'

  let { googleEnabled = false, notice = null }: { googleEnabled?: boolean; notice?: string | null } = $props()

  const form = useForm({ email: '', password: '' })

  function submit(e: SubmitEvent) {
    e.preventDefault()
    form.post('/login')
  }
</script>

<svelte:head><title>Login</title></svelte:head>

<AuthLayout>
  <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">Welcome back</h1>
  <p class="text-muted mb-5">Log in to your account to continue.</p>

  {#if notice}
    <Alert variant="success" class="mb-5">{notice}</Alert>
  {/if}

  {#if googleEnabled}
    <Button href="/auth/google" variant="secondary" fullWidth>
      Log in with Google
    </Button>
    <div class="flex items-center gap-3 text-muted text-xs my-5">
      <span class="flex-1 h-px bg-border"></span>
      or
      <span class="flex-1 h-px bg-border"></span>
    </div>
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

    <TextField
      id="password"
      label="Password"
      error={form.errors.password}
      type="password"
      name="password"
      autocomplete="current-password"
      bind:value={form.password}
      onchange={() => form.clearErrors('password')}
    />

    <div class="flex justify-end -mt-1 mb-4">
      <Link href="/forgot-password" class="text-sm">Forgot your password?</Link>
    </div>

    <Button type="submit" fullWidth loading={form.processing}>
      {form.processing ? 'Signing in…' : 'Sign in'}
    </Button>
  </form>

  <p class="mt-5 text-center text-muted text-sm">
    No account yet? <Link href="/register">Create one</Link>
  </p>
</AuthLayout>
