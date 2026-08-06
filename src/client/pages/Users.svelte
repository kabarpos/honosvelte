<script lang="ts">
  import { router, useForm, usePage } from '@inertiajs/svelte'
  import Layout from '../components/Layout.svelte'
  import Card from '../components/Card.svelte'
  import Table from '../components/Table.svelte'
  import Field from '../components/Field.svelte'
  import Input from '../components/Input.svelte'
  import Select from '../components/Select.svelte'
  import Button from '../components/Button.svelte'
  import Badge from '../components/Badge.svelte'
  import Modal from '../components/Modal.svelte'
  import Pagination from '../components/Pagination.svelte'
  import type { Paginated, RoleRecord, User } from '../../shared/types'

  let { users, roles, search }: {
    users: Paginated<User>
    roles: RoleRecord[]
    search: string
  } = $props()

  const page = usePage()
  const currentUser = $derived(page.props.auth.user)
  const { currentPage, lastPage } = $derived(users.meta)

  const ROLE_OPTIONS = $derived(roles.map((r) => ({ value: r.slug, label: r.name })))
  const STATUS_OPTIONS = ['active', 'inactive'].map((s) => ({ value: s, label: s }))

  let createOpen = $state(false)
  let editOpen = $state(false)
  let deleteOpen = $state(false)
  let editUser = $state<User | null>(null)
  let deleteUser = $state<User | null>(null)
  let searchForm = $state(useForm({ q: search }))

  let createForm = $state(
    useForm({
      name: '',
      email: '',
      whatsapp: '',
      role: 'user',
      status: 'active',
      password: '',
      passwordConfirmation: '',
    }),
  )
  let editForm = $state(
    useForm({
      name: '',
      email: '',
      whatsapp: '',
      role: 'user',
      status: 'active',
      password: '',
      passwordConfirmation: '',
    }),
  )
  let deleteForm = $state(useForm({ email: '' }))

  function openCreate() {
    createForm.reset()
    createOpen = true
  }

  function openEdit(u: User) {
    editUser = u
    editForm = useForm({
      name: u.name,
      email: u.email,
      whatsapp: u.whatsapp || '',
      role: u.role,
      status: u.status,
      password: '',
      passwordConfirmation: '',
    })
    editOpen = true
  }

  function submitCreate(e: SubmitEvent) {
    e.preventDefault()
    createForm.post('/users', { onSuccess: () => (createOpen = false) })
  }

  function submitEdit(e: SubmitEvent) {
    e.preventDefault()
    if (!editUser) return
    editForm.patch(`/users/${editUser.id}`, {
      onSuccess: () => {
        editOpen = false
        editUser = null
      },
    })
  }

  function submitDelete(e: SubmitEvent) {
    e.preventDefault()
    if (!deleteUser) return
    deleteForm.delete(`/users/${deleteUser.id}`, {
      onSuccess: () => {
        deleteOpen = false
        deleteUser = null
      },
    })
  }

  function toggleStatus(u: User) {
    router.post(`/users/${u.id}/status`, {
      status: u.status === 'active' ? 'inactive' : 'active',
    })
  }

  function doSearch(e: SubmitEvent) {
    e.preventDefault()
    router.get('/users', { search: searchForm.q }, {
      preserveState: true,
      replace: true,
    })
  }

  function pageUrl(p: number): string {
    const q = search ? `&search=${encodeURIComponent(search)}` : ''
    return `/users?page=${p}${q}`
  }

  const wrapper =
    'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-border rounded-lg bg-transparent text-text cursor-pointer transition-colors hover:bg-primary-soft'
</script>

<svelte:head><title>Users</title></svelte:head>

{#if currentUser && currentUser.role === 'admin'}
  <Layout>
    <div class="flex items-start justify-between gap-4 mb-3">
      <div>
        <h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">Users</h1>
        <p class="text-muted mb-0">
          {users.meta.total} user{users.meta.total === 1 ? '' : 's'} total — page
          {currentPage} of {lastPage}.
        </p>
      </div>
      <Button onclick={openCreate}>Add user</Button>
    </div>

    <form class="mb-4 flex gap-2" onsubmit={doSearch}>
      <input
        type="search"
        name="q"
        class="w-full max-w-[320px] px-3 py-2.5 border border-border rounded-lg bg-bg text-text text-sm focus:outline-2 focus:outline-primary focus:-outline-offset-1"
        placeholder="Search by name or email…"
        bind:value={searchForm.q}
        aria-label="Search users"
      />
      <Button variant="secondary" type="submit">Search</Button>
    </form>

    <Card class="p-0 overflow-hidden">
      <Table>
        <thead>
          <tr>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Name
            </th>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Email
            </th>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              WhatsApp
            </th>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Role
            </th>
            <th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Status
            </th>
            <th class="text-right px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="[&>tr:last-child>td]:border-b-0">
          {#each users.data as u (u.id)}
            <tr class="transition-colors hover:bg-primary-soft">
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
                {u.name}
              </td>
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
                {u.email}
              </td>
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
                {u.whatsapp || '—'}
              </td>
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
                <Badge variant={u.role === 'super_admin' ? 'amber' : u.role === 'admin' ? 'primary' : 'neutral'}>
                  {u.role}
                </Badge>
              </td>
              <td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
                <Badge variant={u.status === 'active' ? 'primary' : 'neutral'}>
                  {u.status}
                </Badge>
              </td>
              <td class="text-right px-3 py-2.5 border-b border-border whitespace-nowrap">
                <div class="inline-flex items-center gap-1.5">
                  <button type="button" class={wrapper} onclick={() => openEdit(u)}>
                    Edit
                  </button>
                  {#if u.id !== currentUser?.id}
                    <button type="button" class={wrapper} onclick={() => toggleStatus(u)}>
                      {u.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" class={`${wrapper} text-danger`} onclick={() => { deleteUser = u; deleteOpen = true }}>Delete</button>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
          {#if users.data.length === 0}
            <tr>
              <td colspan={6} class="text-center text-muted p-6">
                No users {search ? 'matched that search' : 'yet'}.
              </td>
            </tr>
          {/if}
        </tbody>
      </Table>
    </Card>

    <div class="mt-4 flex justify-end">
      <Pagination page={currentPage} totalPages={lastPage} />
    </div>

    <Modal open={createOpen} title="Add user" size="md">
      <form onsubmit={submitCreate} novalidate>
        <Field id="cu-name" label="Name" error={createForm.errors.name}>
          <Input id="cu-name" bind:value={createForm.name} onchange={() => createForm.clearErrors('name')} />
        </Field>
        <Field id="cu-email" label="Email" error={createForm.errors.email}>
          <Input id="cu-email" type="email" bind:value={createForm.email} onchange={() => createForm.clearErrors('email')} />
        </Field>
        <Field id="cu-wa" label="WhatsApp" error={createForm.errors.whatsapp}>
          <Input id="cu-wa" bind:value={createForm.whatsapp} onchange={() => createForm.clearErrors('whatsapp')} />
        </Field>
        <div class="grid grid-cols-2 gap-3">
          <Field id="cu-role" label="Role" error={createForm.errors.role}>
            <Select id="cu-role" bind:value={createForm.role} options={ROLE_OPTIONS} />
          </Field>
          <Field id="cu-status" label="Status" error={createForm.errors.status}>
            <Select id="cu-status" bind:value={createForm.status} options={STATUS_OPTIONS} />
          </Field>
        </div>
        <Field id="cu-pass" label="Password" error={createForm.errors.password}>
          <Input id="cu-pass" type="password" bind:value={createForm.password} onchange={() => createForm.clearErrors('password')} />
        </Field>
        <Field id="cu-pass2" label="Confirm password" error={createForm.errors.passwordConfirmation}>
          <Input id="cu-pass2" type="password" bind:value={createForm.passwordConfirmation} onchange={() => createForm.clearErrors('passwordConfirmation')} />
        </Field>
        <div class="flex items-center justify-end gap-2 mt-4">
          <Button variant="ghost" type="button" onclick={() => (createOpen = false)}>Cancel</Button>
          <Button variant="primary" type="submit" loading={createForm.processing}>Create</Button>
        </div>
      </form>
    </Modal>

    {#if editUser}
      <Modal open={editOpen} title={`Edit ${editUser.name}`} size="md">
        <form onsubmit={submitEdit} novalidate>
          <Field id="eu-name" label="Name" error={editForm.errors.name}>
            <Input id="eu-name" bind:value={editForm.name} onchange={() => editForm.clearErrors('name')} />
          </Field>
          <Field id="eu-email" label="Email" error={editForm.errors.email}>
            <Input id="eu-email" type="email" bind:value={editForm.email} onchange={() => editForm.clearErrors('email')} />
          </Field>
          <Field id="eu-wa" label="WhatsApp" error={editForm.errors.whatsapp}>
            <Input id="eu-wa" bind:value={editForm.whatsapp} onchange={() => editForm.clearErrors('whatsapp')} />
          </Field>
          <div class="grid grid-cols-2 gap-3">
            <Field id="eu-role" label="Role" error={editForm.errors.role}>
              <Select id="eu-role" bind:value={editForm.role} options={ROLE_OPTIONS} />
            </Field>
            <Field id="eu-status" label="Status" error={editForm.errors.status}>
              <Select id="eu-status" bind:value={editForm.status} options={STATUS_OPTIONS} />
            </Field>
          </div>
          <p class="text-xs text-muted mb-3">Leave the password fields blank to keep the current password.</p>
          <Field id="eu-pass" label="New password" error={editForm.errors.password}>
            <Input id="eu-pass" type="password" bind:value={editForm.password} onchange={() => editForm.clearErrors('password')} />
          </Field>
          <Field id="eu-pass2" label="Confirm new password" error={editForm.errors.passwordConfirmation}>
            <Input id="eu-pass2" type="password" bind:value={editForm.passwordConfirmation} onchange={() => editForm.clearErrors('passwordConfirmation')} />
          </Field>
          <div class="flex items-center justify-end gap-2 mt-4">
            <Button variant="ghost" type="button" onclick={() => (editOpen = false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={editForm.processing}>Save</Button>
          </div>
        </form>
      </Modal>
    {/if}

    {#if deleteUser}
      <Modal open={deleteOpen} title="Delete user" size="sm">
        <p>Delete <strong>{deleteUser.name}</strong> ({deleteUser.email})? This cannot be undone.</p>
        {#if deleteForm.errors.email}
          <p class="text-danger text-xs mt-2">{deleteForm.errors.email}</p>
        {/if}
        <div class="flex items-center justify-end gap-2 mt-4">
          <Button variant="ghost" type="button" onclick={() => (deleteOpen = false)}>Cancel</Button>
          <Button variant="danger" type="button" loading={deleteForm.processing} onclick={submitDelete}>Delete</Button>
        </div>
      </Modal>
    {/if}
  </Layout>
{/if}