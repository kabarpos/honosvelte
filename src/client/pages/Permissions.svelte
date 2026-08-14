<script lang="ts">
  import { useForm } from '@inertiajs/svelte'
  import { can } from '../capabilities'
  import Layout from '../components/Layout.svelte'
  import Card from '../components/Card.svelte'
  import Table from '../components/Table.svelte'
  import Field from '../components/Field.svelte'
  import Input from '../components/Input.svelte'
  import Button from '../components/Button.svelte'
  import Modal from '../components/Modal.svelte'
  import RowActions from '../components/RowActions.svelte'
  import type { Permission } from '../../shared/types'

  let { permissions }: { permissions: Permission[] } = $props()

  let createOpen = $state(false)
  let editPerm = $state<Permission | null>(null)
  let editOpen = $state(false)
  let deletePerm = $state<Permission | null>(null)
  let deleteOpen = $state(false)

  let createForm = $state(useForm({ slug: '', name: '', description: '' }))
  let editForm = $state(useForm({ slug: '', name: '', description: '' }))
  let deleteForm = $state(useForm({ slug: '' }))

  function openCreate() {
    createForm.reset()
    createOpen = true
  }

  function openEdit(p: Permission) {
    editPerm = p
    editForm.setStore({
      slug: p.slug,
      name: p.name,
      description: p.description || '',
    })
    editForm.clearErrors()
    editOpen = true
  }

  function submitCreate(e: SubmitEvent) {
    e.preventDefault()
    createForm.post('/permissions', { onSuccess: () => (createOpen = false) })
  }

  function submitEdit(e: SubmitEvent) {
    e.preventDefault()
    if (!editPerm) return
    editForm.patch(`/permissions/${editPerm.id}`, {
      onSuccess: () => {
        editOpen = false
        editPerm = null
      },
    })
  }

  function submitDelete(e: SubmitEvent) {
    e.preventDefault()
    if (!deletePerm) return
    deleteForm.delete(`/permissions/${deletePerm.id}`, {
      onSuccess: () => {
        deleteOpen = false
        deletePerm = null
      },
    })
  }

</script>

<svelte:head><title>Permissions</title></svelte:head>

{#if can('permissions.read')}
  <Layout>
    <div class="flex items-start justify-between gap-4 mb-3">
      <div>
        <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">Permissions</h1>
        <p class="text-muted mb-0">
          {permissions.length} permission{permissions.length === 1 ? '' : 's'} in the
          catalogue, assigned to roles.
        </p>
      </div>
      <Button onclick={openCreate}>Add permission</Button>
    </div>

    <Card class="p-0 overflow-hidden">
      <Table>
        <thead>
          <tr>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Slug
            </th>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Name
            </th>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Description
            </th>
            <th class="text-right px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="[&>tr:last-child>td]:border-b-0">
          {#each permissions as p (p.id)}
            <tr class="transition-colors hover:bg-primary-soft">
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
                <code class="text-xs bg-bg border border-border rounded px-1.5 py-0.5">{p.slug}</code>
              </td>
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
                {p.name}
              </td>
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted">
                {p.description || '—'}
              </td>
              <td class="text-right px-3 py-2.5 border-b border-border whitespace-nowrap">
                <RowActions
                  items={[
                    { label: 'Edit', onClick: () => openEdit(p) },
                    {
                      label: 'Delete',
                      danger: true,
                      onClick: () => {
                        deletePerm = p
                        deleteOpen = true
                      },
                    },
                  ]}
                />
              </td>
            </tr>
          {/each}
          {#if permissions.length === 0}
            <tr>
              <td colspan={4} class="text-center text-muted p-6">No permissions yet.</td>
            </tr>
          {/if}
        </tbody>
      </Table>
    </Card>

    <Modal open={createOpen} title="Add permission" size="md">
      <form onsubmit={submitCreate} novalidate>
        <Field id="cp-slug" label="Slug" error={createForm.errors.slug}>
          <Input id="cp-slug" bind:value={createForm.slug} placeholder="e.g. reports.read" onchange={() => createForm.clearErrors('slug')} />
        </Field>
        <Field id="cp-name" label="Name" error={createForm.errors.name}>
          <Input id="cp-name" bind:value={createForm.name} onchange={() => createForm.clearErrors('name')} />
        </Field>
        <Field id="cp-desc" label="Description" error={createForm.errors.description}>
          <Input id="cp-desc" bind:value={createForm.description} onchange={() => createForm.clearErrors('description')} />
        </Field>
        <div class="flex items-center justify-end gap-2 mt-4">
          <Button variant="ghost" type="button" onclick={() => (createOpen = false)}>Cancel</Button>
          <Button variant="primary" type="submit" loading={createForm.processing}>Create</Button>
        </div>
      </form>
    </Modal>

    {#if editPerm}
      <Modal open={editOpen} title={`Edit ${editPerm.name}`} size="md">
        <form onsubmit={submitEdit} novalidate>
          <Field id="ep-slug" label="Slug" error={editForm.errors.slug}>
            <Input id="ep-slug" bind:value={editForm.slug} onchange={() => editForm.clearErrors('slug')} />
          </Field>
          <Field id="ep-name" label="Name" error={editForm.errors.name}>
            <Input id="ep-name" bind:value={editForm.name} onchange={() => editForm.clearErrors('name')} />
          </Field>
          <Field id="ep-desc" label="Description" error={editForm.errors.description}>
            <Input id="ep-desc" bind:value={editForm.description} onchange={() => editForm.clearErrors('description')} />
          </Field>
          <div class="flex items-center justify-end gap-2 mt-4">
            <Button variant="ghost" type="button" onclick={() => (editOpen = false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={editForm.processing}>Save</Button>
          </div>
        </form>
      </Modal>
    {/if}

    {#if deletePerm}
      <Modal open={deleteOpen} title="Delete permission" size="sm">
        <p>Delete <strong>{deletePerm.slug}</strong>? Roles referencing it lose it.</p>
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
