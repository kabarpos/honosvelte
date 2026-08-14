<script lang="ts">
  import { router, useForm } from '@inertiajs/svelte'
  import { can } from '../capabilities'
  import Layout from '../components/Layout.svelte'
  import Card from '../components/Card.svelte'
  import Table from '../components/Table.svelte'
  import Field from '../components/Field.svelte'
  import Input from '../components/Input.svelte'
  import Button from '../components/Button.svelte'
  import Badge from '../components/Badge.svelte'
  import Modal from '../components/Modal.svelte'
  import RowActions from '../components/RowActions.svelte'
  import Checkbox from '../components/Checkbox.svelte'
  import type { Permission, RoleRecord } from '../../shared/types'

  let { roles, permissions }: {
    roles: RoleRecord[]
    permissions: Permission[]
  } = $props()

  let createOpen = $state(false)
  let editRole = $state<RoleRecord | null>(null)
  let editOpen = $state(false)
  let permRole = $state<RoleRecord | null>(null)
  let permOpen = $state(false)
  let deleteRole = $state<RoleRecord | null>(null)
  let deleteOpen = $state(false)

  let createForm = $state(useForm({ slug: '', name: '', description: '' }))
  let editForm = $state(useForm({ slug: '', name: '', description: '' }))
  let permForm = $state(useForm({ permissionSlugs: [] as string[] }))
  let deleteForm = $state(useForm({ slug: '' }))
  let permSel = $state<Record<string, boolean>>({})

  const permGroups = $derived.by(() => {
    const map = new Map<string, Permission[]>()
    for (const p of permissions) {
      const group = p.slug.includes('.') ? (p.slug.split('.')[0] ?? 'other') : 'other'
      const list = map.get(group) ?? []
      list.push(p)
      map.set(group, list)
    }
    return [...map.entries()].map(([key, items]) => ({
      group: key.charAt(0).toUpperCase() + key.slice(1),
      items,
    }))
  })

  function openCreate() {
    createForm.reset()
    createOpen = true
  }

  function openEdit(r: RoleRecord) {
    editRole = r
    editForm.setStore({
      slug: r.slug,
      name: r.name,
      description: r.description || '',
    })
    editForm.clearErrors()
    editOpen = true
  }

  function openPerms(r: RoleRecord) {
    permRole = r
    const sel: Record<string, boolean> = {}
    for (const p of permissions) sel[p.slug] = r.permissionSlugs.includes(p.slug)
    permSel = sel
    permOpen = true
  }

  function submitCreate(e: SubmitEvent) {
    e.preventDefault()
    createForm.post('/roles', { onSuccess: () => (createOpen = false) })
  }

  function submitEdit(e: SubmitEvent) {
    e.preventDefault()
    if (!editRole) return
    editForm.patch(`/roles/${editRole.id}`, {
      onSuccess: () => {
        editOpen = false
        editRole = null
      },
    })
  }

  function submitPerms(e: SubmitEvent) {
    e.preventDefault()
    if (!permRole) return
    const slugs = permissions.filter((p) => permSel[p.slug]).map((p) => p.slug)
    permForm.setStore({ permissionSlugs: slugs })
    permForm.post(`/roles/${permRole.id}/permissions`, {
      onSuccess: () => {
        permOpen = false
        permRole = null
      },
    })
  }

  function submitDelete(e: SubmitEvent) {
    e.preventDefault()
    if (!deleteRole) return
    deleteForm.delete(`/roles/${deleteRole.id}`, {
      onSuccess: () => {
        deleteOpen = false
        deleteRole = null
      },
    })
  }

</script>

<svelte:head><title>Roles</title></svelte:head>

{#if can('roles.read')}
  <Layout>
    <div class="flex items-start justify-between gap-4 mb-3">
      <div>
        <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">Roles</h1>
        <p class="text-muted mb-0">
          {roles.length} role{roles.length === 1 ? '' : 's'} — each role bundles
          permissions that its users inherit.
        </p>
      </div>
      <Button onclick={openCreate}>Add role</Button>
    </div>

    <Card class="p-0 overflow-hidden">
      <Table>
        <thead>
          <tr>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Role
            </th>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Slug
            </th>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Description
            </th>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Permissions
            </th>
            <th class="text-right px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="[&>tr:last-child>td]:border-b-0">
          {#each roles as r (r.id)}
            <tr class="transition-colors hover:bg-primary-soft">
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
                {r.name}
              </td>
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
                <code class="text-xs bg-bg border border-border rounded px-1.5 py-0.5">{r.slug}</code>
              </td>
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted">
                {r.description || '—'}
              </td>
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
                <Badge variant={r.permissionSlugs.length ? 'primary' : 'neutral'}>
                  {r.permissionSlugs.length}
                </Badge>
              </td>
              <td class="text-right px-3 py-2.5 border-b border-border whitespace-nowrap">
                <RowActions
                  items={[
                    { label: 'Edit', onClick: () => openEdit(r) },
                    { label: 'Permissions', onClick: () => openPerms(r) },
                    ...(!['user', 'admin', 'super_admin'].includes(r.slug)
                      ? [
                          {
                            label: 'Delete',
                            danger: true,
                            onClick: () => {
                              deleteRole = r
                              deleteOpen = true
                            },
                          },
                        ]
                      : []),
                  ]}
                />
              </td>
            </tr>
          {/each}
        </tbody>
      </Table>
    </Card>

    <Modal open={createOpen} title="Add role" size="md">
      <form onsubmit={submitCreate} novalidate>
        <Field id="cr-slug" label="Slug" error={createForm.errors.slug}>
          <Input id="cr-slug" bind:value={createForm.slug} placeholder="e.g. editor" onchange={() => createForm.clearErrors('slug')} />
        </Field>
        <Field id="cr-name" label="Name" error={createForm.errors.name}>
          <Input id="cr-name" bind:value={createForm.name} onchange={() => createForm.clearErrors('name')} />
        </Field>
        <Field id="cr-desc" label="Description" error={createForm.errors.description}>
          <Input id="cr-desc" bind:value={createForm.description} onchange={() => createForm.clearErrors('description')} />
        </Field>
        <div class="flex items-center justify-end gap-2 mt-4">
          <Button variant="ghost" type="button" onclick={() => (createOpen = false)}>Cancel</Button>
          <Button variant="primary" type="submit" loading={createForm.processing}>Create</Button>
        </div>
      </form>
    </Modal>

    {#if editRole}
      <Modal open={editOpen} title={`Edit ${editRole.name}`} size="md">
        <form onsubmit={submitEdit} novalidate>
          <Field id="er-slug" label="Slug" error={editForm.errors.slug}>
            <Input id="er-slug" bind:value={editForm.slug} onchange={() => editForm.clearErrors('slug')} />
          </Field>
          <Field id="er-name" label="Name" error={editForm.errors.name}>
            <Input id="er-name" bind:value={editForm.name} onchange={() => editForm.clearErrors('name')} />
          </Field>
          <Field id="er-desc" label="Description" error={editForm.errors.description}>
            <Input id="er-desc" bind:value={editForm.description} onchange={() => editForm.clearErrors('description')} />
          </Field>
          <div class="flex items-center justify-end gap-2 mt-4">
            <Button variant="ghost" type="button" onclick={() => (editOpen = false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={editForm.processing}>Save</Button>
          </div>
        </form>
      </Modal>
    {/if}

    {#if permRole}
      <Modal open={permOpen} title={`Permissions — ${permRole.name}`} size="xl">
        <form onsubmit={submitPerms} novalidate>
          <div class="max-h-[55vh] overflow-y-auto -mx-1 px-1 space-y-5">
            {#each permGroups as g (g.group)}
              <section>
                <h3
                  class="text-xs font-semibold uppercase tracking-wider text-muted mb-2"
                >
                  {g.group}
                </h3>
                <div
                  class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5"
                >
                  {#each g.items as p (p.id)}
                    <Checkbox
                      bind:checked={permSel[p.slug]}
                      label={p.name}
                      description={p.description ?? undefined}
                    />
                  {/each}
                </div>
              </section>
            {/each}
          </div>
          {#if permForm.errors.permissionSlugs}
            <p class="text-danger text-xs mt-3">{permForm.errors.permissionSlugs}</p>
          {/if}
          <div
            class="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-border"
          >
            <Button variant="ghost" type="button" onclick={() => (permOpen = false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={permForm.processing}>Save permissions</Button>
          </div>
        </form>
      </Modal>
    {/if}

    {#if deleteRole}
      <Modal open={deleteOpen} title="Delete role" size="sm">
        <p>Delete <strong>{deleteRole.name}</strong> ({deleteRole.slug})? Users holding this role lose its permissions.</p>
        {#if deleteForm.errors.slug}
          <p class="text-danger text-xs mt-2">{deleteForm.errors.slug}</p>
        {/if}
        <div class="flex items-center justify-end gap-2 mt-4">
          <Button variant="ghost" type="button" onclick={() => (deleteOpen = false)}>Cancel</Button>
          <Button variant="danger" type="button" loading={deleteForm.processing} onclick={submitDelete}>Delete</Button>
        </div>
      </Modal>
    {/if}
  </Layout>
{/if}