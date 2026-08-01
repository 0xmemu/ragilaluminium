import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { ResourceValue } from "@/components/admin/resource-value"
import { ResourceContextPanel } from "@/components/admin/resource-context-panel"
import { RowActions, rowActionTextClass } from "@/components/admin/row-actions"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Input } from "@/components/admin/ui/input"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import AdminLayout from "@/layouts/admin-layout"
import { humanize } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ResourceIndexProps, ResourceRow, ResourceRowAction } from "@/types"

function rowText(row: ResourceRow): string {
  return Object.values(row)
    .filter((value) => typeof value !== "object")
    .join(" ")
    .toLowerCase()
}

function RowActionButtons({ actions }: { actions: ResourceRowAction[] }) {
  if (!actions.length) return null

  return (
    <RowActions>
      {actions.map((action) => {
        const key = `${action.label}-${action.href ?? action.url}`
        const method = action.method ?? (action.href ? "get" : "post")

        if (method === "get" && action.href) {
          return (
            <Button key={key} asChild variant="secondary" size="xs">
              <Link href={action.href}>{action.label}</Link>
            </Button>
          )
        }

        if (!action.url) return null

        const run = () => {
          if (method === "put") {
            router.put(action.url!, {}, { preserveScroll: true })
            return
          }
          if (method === "delete") {
            router.delete(action.url!, { preserveScroll: true })
            return
          }
          router.post(action.url!, {}, { preserveScroll: true })
        }

        if (action.confirm) {
          return (
            <ConfirmAction
              key={key}
              trigger={
                <button type="button" className={cn(rowActionTextClass, "min-h-8 px-2")}>
                  {action.label}
                </button>
              }
              title={action.confirm}
              description="Tindakan ini akan dijalankan pada record yang dipilih."
              confirmLabel={action.label}
              onConfirm={run}
            />
          )
        }

        return (
          <Button key={key} type="button" variant="secondary" size="xs" onClick={run}>
            {action.label}
          </Button>
        )
      })}
    </RowActions>
  )
}

export default function ResourceIndex({
  title,
  description,
  createHref,
  toolbarLinks = [],
  columns = [],
  rows = [],
  pagination,
}: ResourceIndexProps) {
  const initialQuery =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") ?? "" : ""
  const [query, setQuery] = React.useState(initialQuery)
  const statusColumn = columns.find((column) => column.key.includes("status"))
  const [statusFilter, setStatusFilter] = React.useState("")
  const statusOptions = React.useMemo(
    () =>
      statusColumn
        ? Array.from(
            new Set(
              rows
                .map((row) => row[statusColumn.key])
                .filter((value): value is string => typeof value === "string" && value !== ""),
            ),
          )
        : [],
    [rows, statusColumn],
  )
  const showActions = rows.some((row) => Array.isArray(row.actions) && row.actions.length > 0)
  const filteredRows = React.useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesQuery = !normalized || rowText(row).includes(normalized)
      const matchesStatus =
        !statusFilter || !statusColumn || String(row[statusColumn.key]) === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [query, rows, statusColumn, statusFilter])

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    const params = Object.fromEntries(new URLSearchParams(window.location.search))
    if (query.trim()) params.q = query.trim()
    else delete params.q
    router.get(window.location.pathname, params, { preserveState: true, replace: true })
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {toolbarLinks.map((link) => (
        <Button key={link.href} asChild variant="secondary">
          <Link href={link.href}>{link.label}</Link>
        </Button>
      ))}
      {createHref ? (
        <Button asChild>
          <Link href={createHref}>
            <Icon name="plus" className="h-4 w-4" aria-hidden="true" />
            Tambah
          </Link>
        </Button>
      ) : null}
    </div>
  )

  return (
    <AdminLayout
      title={title}
      description={description ?? `${pagination?.total ?? rows.length} record tersedia.`}
      actions={toolbarLinks.length || createHref ? actions : null}
    >
      <Head title={`${title} | Admin`} />

      <ResourceContextPanel rows={rows} />

      <section className="rounded-xl border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <form onSubmit={submitSearch} className="relative flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              data-admin-search
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Cari ${title.toLowerCase()} pada halaman ini`}
              className="pl-10"
              aria-label={`Cari ${title}`}
            />
          </form>
          {statusOptions.length > 1 ? (
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="sm:w-52"
              aria-label={`Filter ${statusColumn?.label ?? "status"}`}
            >
              <option value="">Semua {statusColumn?.label.toLowerCase()}</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </Select>
          ) : null}
          {(query || statusFilter) && (
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("")
                setStatusFilter("")
              }}
            >
              Reset
            </Button>
          )}
        </div>

        {filteredRows.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/70 text-xs text-muted-foreground">
                    {columns.map((column) => (
                      <th key={column.key} className="whitespace-nowrap px-4 py-3 font-semibold">
                        {column.label}
                      </th>
                    ))}
                    {showActions ? (
                      <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Aksi</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.map((row, rowIndex) => (
                    <tr key={String(row.href ?? row.id ?? rowIndex)} className="hover:bg-accent/55">
                      {columns.map((column) => {
                        const href = column.hrefKey ? row[column.hrefKey] : null
                        return (
                          <td key={column.key} className="max-w-sm px-4 py-3.5 align-top">
                            {typeof href === "string" && href ? (
                              <Link
                                href={href}
                                className="font-semibold text-foreground hover:text-primary hover:underline"
                              >
                                <ResourceValue
                                  fieldKey={column.key}
                                  value={row[column.key]}
                                  format={column.format}
                                />
                              </Link>
                            ) : (
                              <ResourceValue
                                fieldKey={column.key}
                                value={row[column.key]}
                                format={column.format}
                              />
                            )}
                          </td>
                        )
                      })}
                      {showActions ? (
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex justify-end">
                            <RowActionButtons
                              actions={Array.isArray(row.actions) ? row.actions : []}
                            />
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border md:hidden">
              {filteredRows.map((row, rowIndex) => {
                const primaryColumn = columns[0]
                const primaryHref = primaryColumn?.hrefKey
                  ? row[primaryColumn.hrefKey]
                  : row.href
                return (
                  <article key={String(row.href ?? row.id ?? rowIndex)} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          {primaryColumn?.label}
                        </p>
                        {typeof primaryHref === "string" && primaryHref ? (
                          <Link href={primaryHref} className="mt-1 block font-semibold text-primary">
                            <ResourceValue
                              fieldKey={primaryColumn?.key}
                              value={row[primaryColumn?.key]}
                              format={primaryColumn?.format}
                            />
                          </Link>
                        ) : (
                          <div className="mt-1 font-semibold">
                            <ResourceValue
                              fieldKey={primaryColumn?.key}
                              value={row[primaryColumn?.key]}
                              format={primaryColumn?.format}
                            />
                          </div>
                        )}
                      </div>
                      {typeof primaryHref === "string" && primaryHref ? (
                        <Link
                          href={primaryHref}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent"
                          aria-label="Buka detail"
                        >
                          <Icon name="arrow-right" className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      ) : null}
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                      {columns.slice(1).map((column) => (
                        <div key={column.key}>
                          <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">
                            {column.label}
                          </dt>
                          <dd className="mt-1 text-sm">
                            <ResourceValue
                              fieldKey={column.key}
                              value={row[column.key]}
                              format={column.format}
                            />
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {Array.isArray(row.actions) && row.actions.length ? (
                      <div className="mt-4">
                        <RowActionButtons actions={row.actions} />
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </>
        ) : (
          <EmptyState
            className="m-4"
            icon="search"
            title={rows.length ? "Record tidak cocok" : "Belum ada record"}
            description={
              rows.length
                ? "Ubah kata pencarian atau hapus filter halaman."
                : `Data ${title.toLowerCase()} akan tampil di sini setelah tersedia.`
            }
            action={
              rows.length ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("")
                    setStatusFilter("")
                  }}
                >
                  Hapus filter
                </Button>
              ) : createHref ? (
                <Button asChild>
                  <Link href={createHref}>Tambah record</Link>
                </Button>
              ) : null
            }
          />
        )}
      </section>

      <Pagination pagination={pagination} />
    </AdminLayout>
  )
}
