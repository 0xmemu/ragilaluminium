import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { RowActions } from "@/components/admin/row-actions"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { Select } from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { Pagination as PaginationData } from "@/types"

interface TabItem {
  key: string
  label: string
  href: string
}

interface LogRow {
  id: number
  no: number
  actor: string
  created_at?: string | null
  category: { key: string; label: string }
  activity: string
  event_type: string
  status: { key: string; label: string; tone: string }
  href?: string | null
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export default function ActivityLogsIndex({
  title,
  description,
  category,
  tabs,
  filters,
  sortOptions,
  rows = [],
  pagination,
  exportUrl,
  total,
}: {
  title: string
  description: string
  category: string
  tabs: TabItem[]
  filters: { q: string; sort: string; category: string }
  sortOptions: Array<{ value: string; label: string }>
  rows: LogRow[]
  pagination: PaginationData | null
  exportUrl: string
  total: number
}) {
  const [q, setQ] = React.useState(filters.q)
  const [sort, setSort] = React.useState(filters.sort)

  function apply(next?: Partial<{ q: string; sort: string }>) {
    router.get(
      routeUrl("admin.activity-logs.index"),
      {
        category: category === "all" ? undefined : category,
        q: next?.q ?? q,
        sort: next?.sort ?? sort,
      },
      { preserveState: true, preserveScroll: true },
    )
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <Button asChild variant="secondary">
          <a href={exportUrl}>
            <Icon name="download" className="size-4" aria-hidden="true" />
            Unduh CSV
          </a>
        </Button>
      }
    >
      <Head title={`${title} | Admin`} />

      <div className="mb-4 flex flex-wrap gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
              category === tab.key
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

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
          placeholder="Cari berdasarkan deskripsi atau user"
          className="min-w-[16rem] flex-1"
        />
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

      <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        {rows.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-tight text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-semibold">No</th>
                    <th className="px-3 py-3 font-semibold">Nama Admin</th>
                    <th className="px-3 py-3 font-semibold">Waktu</th>
                    <th className="px-3 py-3 font-semibold">Kategori</th>
                    <th className="px-3 py-3 font-semibold">Aktivitas</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-border align-top">
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">{row.no}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Icon name="user" className="size-4" aria-hidden="true" />
                          </span>
                          <span className="font-semibold">{row.actor}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{formatDate(row.created_at)}</p>
                        <p className="text-[11px] tabular-nums text-muted-foreground">{formatTime(row.created_at)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={row.category.key} label={row.category.label} />
                      </td>
                      <td className="max-w-[24rem] px-3 py-3 text-muted-foreground">
                        <p>{row.activity}</p>
                        <p className="mt-0.5 font-mono text-[11px]">{row.event_type}</p>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge
                          status={row.status.key}
                          label={row.status.label}
                        />
                      </td>
                      <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
                        <RowActions>
                          {row.href ? (
                            <Button asChild variant="secondary" size="xs">
                              <Link href={row.href}>Detail</Link>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
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
                      <p className="text-xs font-medium text-muted-foreground">Nama Admin</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="inline-flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Icon name="user" className="size-4" aria-hidden="true" />
                        </span>
                        <span className="font-semibold">{row.actor}</span>
                      </div>
                    </div>
                    {row.href ? (
                      <Link
                        href={row.href}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent"
                        aria-label="Buka detail"
                      >
                        <Icon name="arrow-right" className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">No</dt>
                      <dd className="mt-1 text-sm tabular-nums text-muted-foreground">{row.no}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Waktu</dt>
                      <dd className="mt-1 text-sm">
                        <p className="font-medium">{formatDate(row.created_at)}</p>
                        <p className="text-[11px] tabular-nums text-muted-foreground">{formatTime(row.created_at)}</p>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Kategori</dt>
                      <dd className="mt-1 text-sm">
                        <StatusBadge status={row.category.key} label={row.category.label} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Status</dt>
                      <dd className="mt-1 text-sm">
                        <StatusBadge status={row.status.key} label={row.status.label} />
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Aktivitas</dt>
                      <dd className="mt-1 text-sm text-muted-foreground">
                        <p>{row.activity}</p>
                        <p className="mt-0.5 font-mono text-[11px]">{row.event_type}</p>
                      </dd>
                    </div>
                  </dl>
                  {row.href ? (
                    <div className="mt-4">
                      <RowActions>
                        <Button asChild variant="secondary" size="xs">
                          <Link href={row.href}>Detail</Link>
                        </Button>
                      </RowActions>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="Belum ada log pada kategori ini"
            description="Aktivitas kritis (login, order, import, WhatsApp) akan muncul di sini setelah terjadi."
            className="border-0"
          />
        )}
        {pagination ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Menampilkan {rows.length} dari {total} log
            </p>
            <Pagination pagination={pagination} />
          </div>
        ) : null}
      </section>
    </AdminLayout>
  )
}
