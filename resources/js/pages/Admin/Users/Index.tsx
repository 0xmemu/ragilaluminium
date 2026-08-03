import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { RowActions } from "@/components/admin/row-actions"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Input } from "@/components/admin/ui/input"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import type { Pagination as PaginationData } from "@/types"

interface UserRow {
  id: number
  no: number
  name: string
  username: string
  email: string
  status: string
  is_self: boolean
  created_at?: string | null
  edit_href: string
  activate_url: string
  deactivate_url: string
}

export default function UsersIndex({
  title,
  description,
  filters,
  statusOptions,
  sortOptions,
  createHref,
  rows = [],
  pagination,
}: {
  title: string
  description: string
  filters: { q: string; status: string; sort: string }
  statusOptions: Array<{ value: string; label: string }>
  sortOptions: Array<{ value: string; label: string }>
  createHref: string
  rows: UserRow[]
  pagination: PaginationData | null
}) {
  const [q, setQ] = React.useState(filters.q)
  const [status, setStatus] = React.useState(filters.status)
  const [sort, setSort] = React.useState(filters.sort)
  const [busyId, setBusyId] = React.useState<number | null>(null)

  function apply(next?: Partial<{ q: string; status: string; sort: string }>) {
    router.get(
      routeUrl("admin.users.index"),
      {
        q: next?.q ?? q,
        status: next?.status ?? status,
        sort: next?.sort ?? sort,
      },
      { preserveState: true, preserveScroll: true },
    )
  }

  function postStatus(url: string, id: number) {
    setBusyId(id)
    router.post(url, {}, {
      preserveScroll: true,
      onFinish: () => setBusyId(null),
    })
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <Button asChild>
          <Link href={createHref}>
            <Icon name="plus" className="size-4" aria-hidden="true" />
            Tambah admin
          </Link>
        </Button>
      }
    >
      <Head title={`${title} | Admin`} />

      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          apply({ q })
        }}
      >
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Cari nama, username, atau email"
          className="min-w-[16rem] flex-1"
        />
        <Select
          value={status}
          onChange={(event) => {
            const value = event.target.value
            setStatus(value)
            apply({ status: value })
          }}
          className="w-40"
        >
          {statusOptions.map((option) => (
            <option key={option.value || "all-status"} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          value={sort}
          onChange={(event) => {
            const value = event.target.value
            setSort(value)
            apply({ sort: value })
          }}
          className="w-40"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Button type="submit">Cari</Button>
      </form>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        {rows.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-tight text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-semibold">No</th>
                    <th className="px-3 py-3 font-semibold">Nama</th>
                    <th className="px-3 py-3 font-semibold">Username</th>
                    <th className="px-3 py-3 font-semibold">Email penerima</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-border align-top">
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">{row.no}</td>
                      <td className="px-3 py-3">
                        <Link href={row.edit_href} className="font-semibold hover:text-primary hover:underline">
                          {row.name}
                        </Link>
                        {row.is_self ? (
                          <p className="mt-0.5 text-[11px] font-semibold text-primary">Anda</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs font-semibold text-foreground">{row.username}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{row.email}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
                        <RowActions>
                          <Button asChild variant="secondary" size="xs">
                            <Link href={row.edit_href}>Edit</Link>
                          </Button>
                          {row.status === "active" ? (
                            row.is_self ? (
                              <Button variant="secondary" size="xs" disabled>
                                Nonaktifkan
                              </Button>
                            ) : (
                              <ConfirmAction
                                trigger={
                                  <Button
                                    variant="destructive"
                                    size="xs"
                                    disabled={busyId === row.id}
                                  >
                                    Nonaktifkan
                                  </Button>
                                }
                                title="Nonaktifkan akun?"
                                description={`${row.name} tidak dapat login sampai diaktifkan kembali.`}
                                confirmLabel="Nonaktifkan"
                                processing={busyId === row.id}
                                onConfirm={() => postStatus(row.deactivate_url, row.id)}
                              />
                            )
                          ) : (
                            <Button
                              variant="secondary"
                              size="xs"
                              disabled={busyId === row.id}
                              onClick={() => postStatus(row.activate_url, row.id)}
                            >
                              Aktifkan
                            </Button>
                          )}
                        </RowActions>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border md:hidden">
              {rows.map((row) => (
                <article key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Nama</p>
                      <Link href={row.edit_href} className="mt-1 block font-semibold text-primary">
                        {row.name}
                      </Link>
                      {row.is_self ? (
                        <p className="mt-0.5 text-[11px] font-semibold text-primary">Anda</p>
                      ) : null}
                    </div>
                    <Link
                      href={row.edit_href}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent"
                      aria-label="Buka detail"
                    >
                      <Icon name="arrow-right" className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                  <dl className="mt-4 grid sm:grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">No</dt>
                      <dd className="mt-1 text-sm tabular-nums text-muted-foreground">{row.no}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Status</dt>
                      <dd className="mt-1 text-sm">
                        <StatusBadge status={row.status} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Username</dt>
                      <dd className="mt-1 font-mono text-xs font-semibold text-foreground">{row.username}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Email penerima</dt>
                      <dd className="mt-1 truncate font-mono text-xs text-muted-foreground">{row.email}</dd>
                    </div>
                  </dl>
                  <div className="mt-4">
                    <RowActions>
                      <Button asChild variant="secondary" size="xs">
                        <Link href={row.edit_href}>Edit</Link>
                      </Button>
                      {row.status === "active" ? (
                        row.is_self ? (
                          <Button variant="secondary" size="xs" disabled>
                            Nonaktifkan
                          </Button>
                        ) : (
                          <ConfirmAction
                            trigger={
                              <Button
                                variant="destructive"
                                size="xs"
                                disabled={busyId === row.id}
                              >
                                Nonaktifkan
                              </Button>
                            }
                            title="Nonaktifkan akun?"
                            description={`${row.name} tidak dapat login sampai diaktifkan kembali.`}
                            confirmLabel="Nonaktifkan"
                            processing={busyId === row.id}
                            onConfirm={() => postStatus(row.deactivate_url, row.id)}
                          />
                        )
                      ) : (
                        <Button
                          variant="secondary"
                          size="xs"
                          disabled={busyId === row.id}
                          onClick={() => postStatus(row.activate_url, row.id)}
                        >
                          Aktifkan
                        </Button>
                      )}
                    </RowActions>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="Belum ada akun admin"
            description="Tambah staf agar mereka dapat masuk ke panel."
            className="border-0"
          />
        )}
      </section>

      {pagination ? <div className="mt-4"><Pagination pagination={pagination} /></div> : null}
    </AdminLayout>
  )
}
