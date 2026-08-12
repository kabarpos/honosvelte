<script lang="ts">
  import { usePage } from '@inertiajs/svelte'
  import Layout from '../components/Layout.svelte'
  import Card from '../components/Card.svelte'
  import Table from '../components/Table.svelte'
  import type { PaymentRow, PlanInfo } from '../../shared/types'

  let { plan, payments }: { plan: PlanInfo; payments: PaymentRow[] } = $props()

  const page = usePage()
  const user = $derived(page.props.auth.user)

  const STATUS_CLASS: Record<PaymentRow['status'], string> = {
    paid: 'bg-success-bg text-success-fg border border-success-border',
    pending: 'bg-warning-bg text-warning-fg border border-warning-border',
    failed: 'bg-danger-bg text-danger-fg border border-danger-border',
  }
</script>

<svelte:head><title>Billing</title></svelte:head>

{#if user}
  <Layout>
    <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">Billing</h1>
    <p class="text-muted mb-3">
      Payment gateway is a deliberate swap point — wire your provider here.
    </p>

    <section
      class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 my-6"
    >
      <Card class="p-6 flex flex-col gap-3">
        <span class="text-xs uppercase tracking-wider text-muted">
          Current plan
        </span>
        <div class="flex items-baseline justify-between gap-4">
          <span class="text-[1.5rem] font-bold">{plan.name}</span>
          <span class="text-muted">{plan.price}</span>
        </div>
        <span class="text-[0.82rem] text-muted">Renews {plan.renewsAt}</span>
      </Card>

      <Card class="p-6 flex flex-col gap-3">
        <span class="text-xs uppercase tracking-wider text-muted">Usage</span>
        {#each plan.limits as limit (limit.label)}
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-[0.82rem]">
              <span>{limit.label}</span>
              <span class="text-muted">{limit.used} / {limit.max}</span>
            </div>
            <div class="h-2 rounded-full bg-bg overflow-hidden">
              <div
                class="h-full rounded-full bg-primary"
                style="width:{Math.min(100, (limit.used / limit.max) * 100)}%"
              ></div>
            </div>
          </div>
        {/each}
      </Card>
    </section>

    <Card class="p-6">
      <h2 class="text-[1.1rem] m-0 mb-3">Payment history</h2>
      <Table>
        <thead>
          <tr>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Invoice
            </th>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Date
            </th>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Description
            </th>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Amount
            </th>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Status
            </th>
          </tr>
        </thead>
        <tbody class="[&>tr:last-child>td]:border-b-0">
          {#each payments as p (p.id)}
            <tr class="transition-colors hover:bg-primary-soft">
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
                {p.invoice}
              </td>
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
                {p.date}
              </td>
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
                {p.description}
              </td>
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
                {p.amount}
              </td>
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.75rem] capitalize {STATUS_CLASS[p.status]}"
                >
                  {p.status}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </Table>
      {#if payments.length === 0}
        <p class="text-muted text-sm">No payments recorded yet.</p>
      {/if}
    </Card>
  </Layout>
{/if}