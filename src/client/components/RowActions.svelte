<script lang="ts">
  export type RowAction = {
    label: string
    onClick: () => void
    danger?: boolean
  }

  let {
    items,
  }: {
    items: RowAction[]
  } = $props()

  let open = $state(false)
  let trigger = $state<HTMLButtonElement | null>(null)
  let menu = $state<HTMLDivElement | null>(null)
  let menuTop = $state(0)
  let menuLeft = $state(0)

  const GAP = 6
  const PAD = 8

  function place() {
    if (!open || !trigger || !menu) return
    const tr = trigger.getBoundingClientRect()
    const mr = menu.getBoundingClientRect()
    let top = tr.top + tr.height / 2
    if (top - mr.height / 2 < PAD) top = PAD + mr.height / 2
    if (top + mr.height / 2 > window.innerHeight - PAD)
      top = window.innerHeight - PAD - mr.height / 2
    let left = tr.right - mr.width
    if (left < PAD) left = PAD
    if (left + mr.width > window.innerWidth - PAD)
      left = window.innerWidth - PAD - mr.width
    menuTop = top
    menuLeft = left
  }

  function toggle() {
    open = !open
    if (open) requestAnimationFrame(place)
  }

  function run(item: RowAction) {
    open = false
    item.onClick()
  }

  $effect(() => {
    if (!open) return
    place()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') open = false
    }
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node
      if (trigger && !trigger.contains(t) && menu && !menu.contains(t)) open = false
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDoc)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDoc)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  })
</script>

<div class="relative inline-flex">
  <button
    bind:this={trigger}
    type="button"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label="Actions"
    onclick={toggle}
    class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted cursor-pointer transition-colors hover:bg-primary-soft hover:text-text"
  >
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  </button>

  {#if open}
    <div
      bind:this={menu}
      role="menu"
      class="fixed z-50 w-44 rounded-lg bg-surface border border-border shadow-card animate-[menu-in_140ms_ease] overflow-hidden"
      style={`top: ${menuTop}px; left: ${menuLeft}px; transform: translateY(-50%);`}
    >
      {#each items as item (item.label)}
        <button
          type="button"
          role="menuitem"
          class={`w-full flex items-center gap-2 px-3.5 py-2.5 text-left text-sm whitespace-nowrap cursor-pointer transition-colors hover:bg-primary-soft ${item.danger ? 'text-danger' : 'text-text'}`}
          onclick={() => run(item)}
        >
          {item.label}
        </button>
      {/each}
    </div>
  {/if}
</div>