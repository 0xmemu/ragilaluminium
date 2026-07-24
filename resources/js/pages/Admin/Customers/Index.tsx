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
import { formatCurrency, formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { Pagination as PaginationData } from "@/types"

interface CustomerRow {
  id: number
  code: string
  no: number
  name: string
  phone: string
  email?: string | null
  location: string
  order_count: number
  total_spent: number
  status: { key: string; label: string }
  fraud: { score: number; label: string; tone: string }
  whatsapp_url: string
  href: string
  edit_href: string
}

interface Summary {
  top_province: { name: string; share_percent: number }
  total_customers: number
  growth_percent: number
  multi_address_customers: number
  avg_fraud_score: number
  avg_fraud_label: string
}

export default function CustomersIndex({
  title,
  description,
  filters,
  sortOptions,
  rows = [],
  pagination,
  summary,
  exportUrl,
}: {
  title: string
  description: string
  filters: { q: string; sort: string }
  sortOptions: Array<{ value: string; label: string }>
  rows: CustomerRow[]
  pagination: PaginationData | null
  summary: Summary
  exportUrl: string
}) {
  const [q, setQ] = React.useState(filters.q)
  const [sort, setSort] = React.useState(filters.sort)

  function apply(next?: Partial<{ q: string; sort: string }>) {
    router.get(
      routeUrl("admin.customers.index"),
      {
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
          placeholder="Cari nama atau nomor hp pelanggan"
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
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-tight text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-semibold">No</th>
                  <th className="px-3 py-3 font-semibold">Nama lengkap</th>
                  <th className="px-3 py-3 font-semibold">Kontak WhatsApp</th>
                  <th className="px-3 py-3 font-semibold">Lokasi</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Fraud score</th>
                  <th className="px-3 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">{row.no}</td>
                    <td className="px-3 py-3">
                      <Link href={row.href} className="font-semibold hover:text-primary hover:underline">
                        {row.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">ID: {row.code}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatNumber(row.order_count)} pesanan · {formatCurrency(row.total_spent)}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <a
                        href={row.whatsapp_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-primary hover:underline"
                      >
                        <Icon name="whatsapp" className="size-4" aria-hidden="true" />
                        {row.phone}
                      </a>
                    </td>
                    <td className="max-w-[14rem] px-3 py-3 text-muted-foreground">{row.location}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={row.status.key} label={row.status.label} />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold tabular-nums">{row.fraud.score}/100</p>
                      <p
                        className={cn(
                          "text-[11px] font-semibold",
                          row.fraud.tone === "success" && "text-success",
                          row.fraud.tone === "warning" && "text-warning-foreground",
                          row.fraud.tone === "danger" && "text-destructive",
                        )}
                      >
                        {row.fraud.label}
                      </p>
                    </td>
                    <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
                      <RowActions>
                        <Button asChild variant="secondary" size="xs">
                          <Link href={row.edit_href}>Edit</Link>
                        </Button>
                        <Button asChild variant="secondary" size="xs">
                          <Link href={row.href}>Detail</Link>
                        </Button>
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Belum ada pelanggan"
            description="Pelanggan muncul otomatis setelah ada pesanan checkout."
            className="border-0"
          />
        )}
        {pagination ? (
          <div className="border-t border-border px-4 py-3">
            <Pagination pagination={pagination} />
          </div>
        ) : null}
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">Provinsi teratas</p>
          <p className="mt-3 text-xl font-bold">{summary.top_province.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{summary.top_province.share_percent}% dari total pelanggan</p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">Total pelanggan</p>
          <p className="mt-3 text-xl font-bold tabular-nums">{formatNumber(summary.total_customers)}</p>
          <p className="mt-1 text-sm text-muted-foreground">+{formatNumber(summary.growth_percent)}% dari bulan lalu</p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">Peringatan alamat ganda</p>
          <p className="mt-3 text-xl font-bold tabular-nums">{formatNumber(summary.multi_address_customers)} pelanggan</p>
          <p className="mt-1 text-sm text-muted-foreground">Memiliki lebih dari satu alamat aktif</p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">Skor fraud rata-rata</p>
          <p className="mt-3 text-xl font-bold tabular-nums">{summary.avg_fraud_score} / 100</p>
          <p className="mt-1 text-sm text-muted-foreground">Status: {summary.avg_fraud_label}</p>
        </article>
      </div>
    </AdminLayout>
  )
}
