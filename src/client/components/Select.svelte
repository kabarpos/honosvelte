<script lang="ts">
  type Option = { value: string; label: string; disabled?: boolean };

  let {
    value = $bindable<string>(),
    options,
    placeholder = undefined,
    disabled = false,
    error = false,
    id = undefined,
    class: className = "",
    ...rest
  }: {
    value?: string;
    options: Option[];
    placeholder?: string;
    disabled?: boolean;
    error?: boolean;
    id?: string;
    class?: string;
    [key: string]: unknown;
  } = $props();

  let open = $state(false);
  let root = $state<HTMLDivElement | null>(null);
  let activeIndex = $state(0);

  const selected = $derived(options.find((o) => o.value === value));
  const display = $derived(selected?.label ?? (value ? value : placeholder ?? ""));

  const base =
    "w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-border rounded-lg bg-bg text-text text-[0.95rem] focus:outline-2 focus:outline-primary focus:-outline-offset-1 focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-colors";
  const cls = $derived(
    `${base}${error ? " border-danger focus:border-danger focus:outline-danger" : ""} ${className}`,
  );

  function nextEnabled(from: number, dir: number): number {
    if (options.length === 0) return -1;
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length;
      if (!options[i]?.disabled) return i;
    }
    return from;
  }

  function openMenu() {
    open = true;
    activeIndex = Math.max(0, options.findIndex((o) => o.value === value && !o.disabled));
  }

  function toggle() {
    if (disabled) return;
    if (open) open = false;
    else openMenu();
  }

  function choose(opt: Option) {
    if (opt.disabled) return;
    value = opt.value;
    open = false;
  }

  function onKey(e: KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      open = false;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = nextEnabled(activeIndex, 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = nextEnabled(activeIndex, -1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[activeIndex];
      if (opt) choose(opt);
    }
  }

  $effect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) open = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  });

  // Keep the highlighted / selected option visible as the list scrolls.
  $effect(() => {
    if (!open || activeIndex < 0) return;
    root
      ?.querySelector(`[data-opt="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  });
</script>

<div class="relative w-full" bind:this={root}>
  <button
    {id}
    type="button"
    {disabled}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls={id ? `${id}-menu` : undefined}
    class={cls}
    onclick={toggle}
    {...rest}
  >
    <span class={`truncate ${value ? "text-text" : "text-muted"}`}>{display}</span>
    <svg
      class={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  </button>

  {#if open}
    <div
      id={id ? `${id}-menu` : undefined}
      role="listbox"
      tabindex="-1"
      class="absolute top-full left-0 right-0 mt-1 z-40 max-h-60 overflow-y-auto bg-surface border border-border rounded-lg shadow-card animate-[menu-in_140ms_ease] p-1"
    >
      {#each options as opt, i (opt.value)}
        <button
          type="button"
          role="option"
          aria-selected={opt.value === value}
          data-opt={i}
          disabled={opt.disabled}
          class={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm rounded-md transition-colors ${opt.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-primary-soft"} ${i === activeIndex && !opt.disabled ? "bg-primary-soft" : ""} ${opt.value === value ? "text-text font-medium" : "text-text"}`}
          onclick={() => choose(opt)}
          onmousemove={() => {
            if (!opt.disabled) activeIndex = i;
          }}
        >
          <span class="truncate">{opt.label}</span>
          {#if opt.value === value}
            <svg
              class="shrink-0 text-primary"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
