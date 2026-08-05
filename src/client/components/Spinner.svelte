<script lang="ts">
  let { class: className = "" }: { class?: string } = $props();
</script>

<span
  class={`inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`}
  role="status"
  aria-label="Loading"
></span>
