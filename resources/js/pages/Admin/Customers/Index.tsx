import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { RowActions, RowActionsMenu } from "@/components/admin/row-actions"
import { DropdownMenuItem } from "@/components/admin/ui/dropdown-menu"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { HintTip } from "@/components/admin/ui/hint-tip"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { EmptyState, ErrorState } from "@/components/admin/ui/empty-state"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
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
  address: string
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
  // Galat muat ulang daftar: tampil sebagai ErrorState di area daftar, dengan
  // tombol "Coba lagi" yang mengulang muat ulang. Penanda muat ulang dipakai
  // agar kegagalan aksi lain tidak ikut memunculkan panel galat ini.
  const [refreshError, setRefreshError] = React.useState<string | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)
  const reloadInFlight = React.useRef(false)

  // Satu jalur muat ulang untuk tombol header dan tombol "Coba lagi" pada
  // ErrorState, supaya keduanya berperilaku identik.
  function refreshCustomers() {
    setRefreshing(true)
    reloadInFlight.current = true
    router.reload({
      onSuccess: () => setRefreshError(null),
      onError: () => setRefreshError("Daftar pelanggan belum berhasil dimuat ulang."),
      onFinish: () => {
        reloadInFlight.current = false
        setRefreshing(false)
      },
    })
  }

  // Respons 500 atau koneksi putus tidak masuk ke onError, tetapi Inertia tetap
  // memancarkan event. Keduanya dipetakan ke panel galat, hanya saat muat ulang
  // memang sedang berjalan.
  React.useEffect(() => {
    const fail = () => {
      if (!reloadInFlight.current) return
      setRefreshError("Daftar pelanggan belum berhasil dimuat ulang.")
    }
    const offInvalid = router.on("invalid", fail)
    const offException = router.on("exception", fail)
    return () => {
      offInvalid()
      offException()
    }
  }, [])

  function apply(next?: Partial<{ q: string; sort: string }>) {
    router.get(
      routeUrl("admin.customers.index"),
      {
        q: next?.q ?? q,
        sort: next?.sort ?? sort,
      },
      { preserveState: true, preserveScroll: true, replace: true },
    )
  }

  const hasActiveFilters = Boolean(q?.trim())

  function resetAllFilters() {
    router.get(routeUrl("admin.customers.index"), {}, { preserveState: false, preserveScroll: true })
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={refreshing}
            onClick={refreshCustomers}
            className="inline-flex items-center gap-1.5"
          >
            <Icon name="refresh" className={cn("size-3.5", refreshing ? "animate-spin" : "")} aria-hidden="true" />
            <span>{refreshing ? "Memuat..." : "Muat ulang"}</span>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={exportUrl}>
              <Icon name="download" className="size-4" aria-hidden="true" />
              Ekspor
            </a>
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      {/* 4 Kartu KPI Ringkasan Pelanggan */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-tight text-muted-foreground">Provinsi teratas</p>
          <p className="mt-3 text-xl font-bold">{summary.top_province.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{summary.top_province.share_percent}% dari total pelanggan</p>
        </article>
        <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-tight text-muted-foreground">Total pelanggan</p>
          <p className="mt-3 text-xl font-bold tabular-nums">{formatNumber(summary.total_customers)}</p>
          <p className="mt-1 text-sm text-muted-foreground">+{formatNumber(summary.growth_percent)}% dari bulan lalu</p>
        </article>
        <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-tight text-muted-foreground">Peringatan alamat ganda</p>
          <p className="mt-3 text-xl font-bold tabular-nums">{formatNumber(summary.multi_address_customers)} pelanggan</p>
          <p className="mt-1 text-sm text-muted-foreground">Memiliki lebih dari satu alamat aktif</p>
        </article>
        <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-tight text-muted-foreground">Skor fraud rata-rata</p>
          <p className="mt-3 text-xl font-bold tabular-nums">{summary.avg_fraud_score} / 100</p>
          <p className="mt-1 text-sm text-muted-foreground">Status: {summary.avg_fraud_label}</p>
        </article>
      </div>

      {/* Baris kontrol seragam: search | sort */}
      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: () => apply({ q }),
          placeholder: "Cari nama atau nomor hp pelanggan",
        }}
        sort={
          <Select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value)
              apply({ sort: event.target.value })
            }}
            aria-label="Urutkan"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        }
        className="mb-4"
      />

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
        {refreshError ? (
          <ErrorState
            title="Daftar pelanggan gagal dimuat ulang"
            description={refreshError}
            className="border-0"
            action={
              <Button variant="outline" size="sm" onClick={refreshCustomers} disabled={refreshing}>
                {refreshing ? "Memuat..." : "Coba lagi"}
              </Button>
            }
          />
        ) : rows.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-tight text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-semibold">No</th>
                    <th className="px-3 py-3 font-semibold">Nama lengkap</th>
                    <th className="px-3 py-3 font-semibold">Kontak WhatsApp</th>
                    <th className="px-3 py-3 font-semibold">Alamat</th>
                    <th className="px-3 py-3 font-semibold">
                      <HintTip
                        label="Status"
                        hint="Status keaktifan pelanggan: Aktif (memiliki pesanan dalam 90 hari terakhir), Baru (belum ada riwayat pesanan), atau Tidak aktif (tidak ada pesanan lebih dari 90 hari)."
                      />
                    </th>
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
                      <td className="max-w-[14rem] px-3 py-3 text-muted-foreground">{row.address}</td>
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
                          <RowActionsMenu>
                            <DropdownMenuItem asChild>
                              <Link href={row.href}>Detail pelanggan</Link>
                            </DropdownMenuItem>
                          </RowActionsMenu>
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
                      <p className="text-xs font-medium text-muted-foreground">Nama lengkap</p>
                      <Link href={row.href} className="mt-1 block font-semibold text-primary">
                        {row.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">ID: {row.code}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatNumber(row.order_count)} pesanan · {formatCurrency(row.total_spent)}
                      </p>
                    </div>
                    <Link
                      href={row.href}
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
                      <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Kontak WhatsApp</dt>
                      <dd className="mt-1 text-sm">
                        <a
                          href={row.whatsapp_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-primary hover:underline"
                        >
                          <Icon name="whatsapp" className="size-4" aria-hidden="true" />
                          {row.phone}
                        </a>
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Alamat</dt>
                      <dd className="mt-1 text-sm text-muted-foreground">{row.address}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Status</dt>
                      <dd className="mt-1 text-sm">
                        <StatusBadge status={row.status.key} label={row.status.label} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Fraud score</dt>
                      <dd className="mt-1 text-sm">
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
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4">
                    <RowActions>
                      <Button asChild variant="secondary" size="xs">
                        <Link href={row.edit_href}>Edit</Link>
                      </Button>
                      <Button asChild variant="secondary" size="xs">
                        <Link href={row.href}>Detail</Link>
                      </Button>
                    </RowActions>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : hasActiveFilters ? (
          <EmptyState
            title="Tidak ada pelanggan yang cocok"
            description="Coba ubah atau hapus pencarian untuk melihat pelanggan lain."
            className="border-0"
            action={
              <Button variant="outline" size="sm" onClick={resetAllFilters}>
                Reset Filter
              </Button>
            }
          />
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
    </AdminLayout>
  )
}
