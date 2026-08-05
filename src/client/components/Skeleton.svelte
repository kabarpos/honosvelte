<script lang="ts">
  let {
    width = "100%",
    height = "1rem",
    rounded = "rounded-md",
    class: className = "",
  }: {
    width?: string;
    height?: string;
    rounded?: string;
    class?: string;
  } = $props();
</script>

<span
  class={`block bg-border animate-pulse ${rounded} ${className}`}
  style={`width:${width};height:${height}`}
  aria-hidden="true"
></span>
