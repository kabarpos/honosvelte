<script lang="ts">
  import Brand from './Brand.svelte'
  import Card from './Card.svelte'

  let { children }: { children: import('svelte').Snippet } = $props()
</script>

<main
  class="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(700px_320px_at_50%_-10%,var(--primary-soft),transparent_70%)] bg-bg"
>
  <Card class="w-full max-w-[400px] shadow-card p-8">
    <div class="flex justify-center mb-6">
      <Brand href="/" />
    </div>
    {@render children()}
  </Card>
</main>
