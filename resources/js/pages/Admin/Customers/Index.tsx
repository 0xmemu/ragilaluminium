import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { RowActions } from "@/components/admin/row-actions"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { CopyButton } from "@/components/admin/ui/copy-button"
import { Input } from "@/components/admin/ui/input"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { EmptyState, ErrorState } from "@/components/admin/ui/empty-state"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
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
}


interface Summary {
  top_province: { name: string; share_percent: number }
  total_customers: number
  growth_percent: number
  /** Angka kartu sedang dibatasi periode, jadi keterangan tumbuh tidak bermakna. */
  period_scoped?: boolean
  multi_address_customers: number
  avg_fraud_score: number
  avg_fraud_label: string
}

export default function CustomersIndex({
  title,
  description,
  filters,
  sortOptions,
  activeDatePreset = "",
  dateFrom = "",
  dateTo = "",
  periodLabel = "Semua waktu",
  rows = [],
  pagination,
  summary,
  exportUrl,
}: {
  title: string
  description: string
  filters: { q: string; sort: string }
  sortOptions: Array<{ value: string; label: string }>
  /** Preset periode aktif ('' = Semua waktu). */
  activeDatePreset?: string
  dateFrom?: string
  dateTo?: string
  periodLabel?: string
  rows: CustomerRow[]
  pagination: PaginationData | null
  summary: Summary
  exportUrl: string
}) {
  const [q, setQ] = React.useState(filters.q)
  const [sort, setSort] = React.useState(filters.sort)
  // Filter periode (permintaan owner 2026-09-28). Daftar dibatasi ke pelanggan
  // yang berbelanja pada periode itu, dan angka per baris mengikuti periode.
  const [datePreset, setDatePreset] = React.useState(activeDatePreset)
  const [rangeFrom, setRangeFrom] = React.useState(dateFrom)
  const [rangeTo, setRangeTo] = React.useState(dateTo)
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

  function apply(next?: Partial<{ q: string; sort: string; date_preset: string }>) {
    const preset = next?.date_preset ?? datePreset
    router.get(
      routeUrl("admin.customers.index"),
      {
        q: next?.q ?? q,
        sort: next?.sort ?? sort,
        date_preset: preset || undefined,
        date_from: preset === "range" ? rangeFrom || undefined : undefined,
        date_to: preset === "range" ? rangeTo || undefined : undefined,
      },
      { preserveState: true, preserveScroll: true, replace: true },
    )
  }

  /** Ganti preset periode. Rentang menunggu tanggal diisi lalu ditekan Terapkan. */
  function pilihPeriode(value: string) {
    setDatePreset(value)
    apply({ date_preset: value })
  }

  function terapkanRentang(event: React.FormEvent) {
    event.preventDefault()
    apply({ date_preset: "range" })
  }

  const hasActiveFilters = Boolean(q?.trim() || datePreset)

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
          {summary.period_scoped ? (
            // Angka kartu sudah dibatasi periode, jadi keterangan tumbuh bulan
            // lalu tidak lagi bermakna dan diganti label periode aktif.
            <p className="mt-1 text-sm text-muted-foreground">Periode: {periodLabel}</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">+{formatNumber(summary.growth_percent)}% dari bulan lalu</p>
          )}
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
      >
        {/* Filter periode pelanggan. Artinya "pelanggan yang berbelanja pada
            periode itu", sejalan dengan halaman Pesanan dan Pembayaran; basis
            tanggalnya created_at pesanan. */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={datePreset || "all"}
            onChange={(event) => pilihPeriode(event.target.value === "all" ? "" : event.target.value)}
            className="w-auto"
            aria-label="Filter periode pelanggan"
          >
            <option value="all">Semua waktu</option>
            <option value="today">Hari ini</option>
            <option value="3d">3 hari terakhir</option>
            <option value="7d">7 hari terakhir</option>
            <option value="30d">30 hari terakhir</option>
            <option value="range">Rentang tanggal</option>
          </Select>
          {datePreset === "range" ? (
            <form onSubmit={terapkanRentang} className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={rangeFrom}
                onChange={(event) => setRangeFrom(event.target.value)}
                className="w-36"
                aria-label="Tanggal mulai"
              />
              <span className="text-xs text-muted-foreground">sampai</span>
              <Input
                type="date"
                value={rangeTo}
                onChange={(event) => setRangeTo(event.target.value)}
                className="w-36"
                aria-label="Tanggal akhir"
              />
              <Button type="submit" size="sm" variant="secondary">
                Terapkan
              </Button>
            </form>
          ) : null}
        </div>
      </ListToolbar>

      {datePreset ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Filter aktif">
          <span className="text-[11px] font-medium text-muted-foreground">Periode</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground">
            {periodLabel}
            <button
              type="button"
              onClick={() => pilihPeriode("")}
              className="rounded-full p-0.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label="Hapus filter periode"
            >
              <Icon name="x" className="size-3" aria-hidden="true" />
            </button>
          </span>
        </div>
      ) : null}

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
                <thead className="bg-muted/40 text-left text-xs tracking-tight text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-semibold">No</th>
                    <th className="px-3 py-3 font-semibold">Nama lengkap</th>
                    <th className="px-3 py-3 font-semibold">Kontak WhatsApp</th>
                    <th className="px-3 py-3 font-semibold">Alamat</th>
                    <th className="px-3 py-3 font-semibold">Pesanan &amp; Belanja</th>
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
                        <div className="mt-0.5 flex items-center gap-1">
                          <p className="font-mono text-[11px] text-muted-foreground">ID: {row.code}</p>
                          <CopyButton text={row.code} label="Salin ID customer" compact showTextInTitle />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <a
                          href={row.whatsapp_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-primary hover:underline"
                        >
                          <Icon name="whatsapp" className="size-4" aria-hidden="true" />
                          {row.phone}
                        </a>
                          <CopyButton text={row.phone} label="Salin nomor HP" compact showTextInTitle />
                        </div>
                      </td>
                      <td className="max-w-[14rem] px-3 py-3 text-muted-foreground">{row.address}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold tabular-nums">{formatNumber(row.order_count)} pesanan</p>
                        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                          {formatCurrency(row.total_spent)}
                        </p>
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
                            <Link href={row.href}>Detail pelanggan</Link>
                          </Button>
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
                      <div className="mt-0.5 flex items-center gap-1">
                        <p className="font-mono text-[11px] text-muted-foreground">ID: {row.code}</p>
                        <CopyButton text={row.code} label="Salin ID customer" compact showTextInTitle />
                      </div>
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
                        <div className="flex items-center gap-1">
                          <a
                          href={row.whatsapp_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-primary hover:underline"
                        >
                          <Icon name="whatsapp" className="size-4" aria-hidden="true" />
                          {row.phone}
                        </a>
                          <CopyButton text={row.phone} label="Salin nomor HP" compact showTextInTitle />
                        </div>
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Alamat</dt>
                      <dd className="mt-1 text-sm text-muted-foreground">{row.address}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Pesanan &amp; belanja</dt>
                      <dd className="mt-1 text-sm">
                        <p className="font-semibold tabular-nums">{formatNumber(row.order_count)} pesanan</p>
                        <p className="text-[11px] tabular-nums text-muted-foreground">{formatCurrency(row.total_spent)}</p>
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
