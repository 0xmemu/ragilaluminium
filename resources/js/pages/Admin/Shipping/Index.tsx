import { Head, Link } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { CopyButton } from "@/components/admin/ui/copy-button"
import { Card } from "@/components/admin/ui/card"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Input } from "@/components/admin/ui/input"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { formatDateTime, formatNumber } from "@/lib/format"
import { navigateFilter } from "@/lib/filter-url"
import { cn } from "@/lib/utils"

export interface ShippingItem {
  id: number
  waybill_number: string
  carrier_name: string
  service_name: string | null
  status: string
  last_status_at: string | null
  order_id: number | null
  order_number: string
  order_status: string | null
  customer_name: string
  customer_phone: string
  /** Alamat penerima utuh: jalan, kelurahan, kecamatan, kota, provinsi, kode pos. */
  customer_address: string
  /** Umur pengiriman sejak resi dicatat, sudah diformat dan diberi nada warna server. */
  age_label: string
  age_tone: "muted" | "warning" | "danger"
  age_hours: number | null
  age_title: string
  /** Tautan ke drawer Lacak Pesanan di detail pesanan terkait (`?lacak=1`). */
  track_href: string
  order_href: string
}

export interface ShippingSummary {
  total_delivered: number
  total_in_transit: number
  total_pending_pickup: number
  total_issue: number
  total_records: number
}

export interface StatusTab {
  key: string
  label: string
  count: number
}

export interface ShippingIndexProps {
  title: string
  description?: string
  summary: ShippingSummary
  tabs: StatusTab[]
  activeStatus: string
  activePaymentMethod: string
  activeDatePreset: string
  dateFrom: string
  dateTo: string
  periodLabel: string
  searchQuery: string
  records: {
    data: ShippingItem[]
    links: Array<{ url: string | null; label: string; active: boolean }>
    from: number | null
    to: number | null
    total: number
    per_page: number
    current_page: number
    last_page: number
  }
}


export default function ShippingIndex({
  title,
  description,
  summary,
  tabs,
  activeStatus,
  activePaymentMethod,
  activeDatePreset,
  dateFrom: initialDateFrom,
  dateTo: initialDateTo,
  periodLabel,
  searchQuery,
  records,
}: ShippingIndexProps) {
  const [q, setQ] = React.useState(searchQuery)
  const [rangeFrom, setRangeFrom] = React.useState(initialDateFrom)
  const [rangeTo, setRangeTo] = React.useState(initialDateTo)

  function visit(params: Record<string, string | undefined>) {
    navigateFilter(
      "admin.shipping.index",
      {
        status: activeStatus,
        payment_method: activePaymentMethod,
        q: searchQuery,
        date_preset: activeDatePreset,
        date_from: activeDatePreset === "range" ? rangeFrom : undefined,
        date_to: activeDatePreset === "range" ? rangeTo : undefined,
      },
      params,
    )
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    visit({ q: q.trim() })
  }

  function applyDateRange(event: React.FormEvent) {
    event.preventDefault()
    visit({
      date_preset: "range",
      date_from: rangeFrom || undefined,
      date_to: rangeTo || undefined,
    })
  }


  return (
    <AdminLayout
      title={title}
      description={
        description ??
        "Monitoring paket ekspedisi J&T Cargo, pelacakan resi, dan serah terima pengiriman pelanggan."
      }
    >
      <Head title={`${title} | Admin`} />

      {/* 4 Kartu KPI Ringkasan Pengiriman */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4 space-y-1 bg-card">
          <p className="text-xs font-medium text-muted-foreground">Paket Sampai (Delivered)</p>
          <p className="font-mono text-lg font-bold tabular-nums text-foreground">
            {formatNumber(summary.total_delivered)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Paket telah berhasil diterima pembeli
          </p>
        </Card>

        <Card className="p-4 space-y-1 bg-card">
          <p className="text-xs font-medium text-muted-foreground">Dalam Perjalanan</p>
          <p className="font-mono text-lg font-bold tabular-nums text-info">
            {formatNumber(summary.total_in_transit)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Paket sedang bergerak di jaringan J&T Cargo
          </p>
        </Card>

        <Card className="p-4 space-y-1 bg-card">
          <p className="text-xs font-medium text-muted-foreground">Menunggu Penjemputan</p>
          <p className="font-mono text-lg font-bold tabular-nums text-warning-foreground">
            {formatNumber(summary.total_pending_pickup)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Resi terbit, menunggu serah terima ke kurir
          </p>
        </Card>

        <Card className="p-4 space-y-1 bg-card">
          <p className="text-xs font-medium text-muted-foreground">Kendala Pengiriman</p>
          <p className="font-mono text-lg font-bold tabular-nums text-destructive">
            {formatNumber(summary.total_issue)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Paket gagal antar atau proses retur
          </p>
        </Card>
      </div>

      {/* Tabs status pengiriman */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 scrollbar-none overflow-x-auto">
          <div
            className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-1"
            role="tablist"
            aria-label="Filter status pengiriman"
          >
            {tabs.map((tab) => {
              const active = tab.key === activeStatus
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => visit({ status: tab.key })}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                    active
                      ? "bg-foreground text-background shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "tabular-nums rounded-full px-1.5 py-px text-[11px] font-semibold",
                      active
                        ? "bg-background/20 text-background"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {formatNumber(tab.count)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-xs">
          <span>
            Total Paket:{" "}
            <strong className="tabular-nums font-semibold text-foreground">
              {formatNumber(summary.total_records)}
            </strong>
          </span>
        </div>
      </div>

      {/* Toolbar filter & search */}
      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: submitSearch,
          placeholder: "Cari nomor resi waybill, nomor order, nama pembeli, atau kota...",
        }}
        className="mb-4 pb-[10px]"
      >
        <Select
          value={activePaymentMethod || "all"}
          onChange={(event) =>
            visit({
              payment_method: event.target.value === "all" ? undefined : event.target.value,
            })
          }
          className="w-auto"
          aria-label="Filter metode pembayaran"
        >
          <option value="all">Semua metode</option>
          <option value="cod">COD (Bayar di Tempat)</option>
          <option value="transfer">Transfer Bank</option>
        </Select>
        <Select
          value={activeDatePreset || "all"}
          onChange={(event) => {
            const value = event.target.value
            if (value === "all") {
              visit({ date_preset: undefined, date_from: undefined, date_to: undefined })
              return
            }
            if (value === "range") {
              visit({
                date_preset: "range",
                date_from: rangeFrom || undefined,
                date_to: rangeTo || undefined,
              })
              return
            }
            visit({ date_preset: value, date_from: undefined, date_to: undefined })
          }}
          className="w-auto"
          aria-label="Filter periode pengiriman"
        >
          <option value="all">Semua waktu</option>
          <option value="today">Hari ini</option>
          <option value="3d">3 hari terakhir</option>
          <option value="7d">7 hari terakhir</option>
          <option value="30d">30 hari terakhir</option>
          <option value="range">Rentang tanggal</option>
        </Select>
        {activeDatePreset === "range" ? (
          <form onSubmit={applyDateRange} className="flex flex-wrap items-center gap-2">
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
      </ListToolbar>

      {activeDatePreset ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Filter aktif">
          <span className="text-[11px] font-medium text-muted-foreground">Periode</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground">
            {periodLabel}
            <button
              type="button"
              onClick={() =>
                visit({ date_preset: undefined, date_from: undefined, date_to: undefined })
              }
              className="rounded-full p-0.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label="Hapus filter periode"
            >
              <Icon name="x" className="size-3" aria-hidden="true" />
            </button>
          </span>
        </div>
      ) : null}

      {/* Tabel Pengiriman Table-First Desktop */}
      <Card className="overflow-hidden border border-border bg-card">
        {records.data.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface/80 text-[11px] font-semibold text-muted-foreground">
                  <th className="w-[9rem] px-4 py-3 text-left">Resi & Kurir</th>
                  <th className="w-[7rem] px-3 py-3 text-left">No. Order</th>
                  <th className="w-[8.5rem] px-3 py-3 text-left">No. HP</th>
                  <th className="w-[17rem] px-4 py-3 text-left">Penerima</th>
                  <th className="w-[8.5rem] px-3 py-3 text-center">Status Pengiriman</th>
                  <th className="w-[7rem] px-3 py-3 text-center">Status Pesanan</th>
                  <th className="w-[8.5rem] px-3 py-3 text-center">Update Terakhir</th>
                  <th className="w-[7rem] px-3 py-3 text-center">Umur</th>
                  <th className="w-[5rem] px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.data.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-muted/40">
                    {/* Kolom 1: Resi & Kurir (Rata Kiri) */}
                    <td className="px-4 py-3 align-middle">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={item.track_href}
                            className="font-mono text-sm font-bold tracking-tight text-foreground hover:text-primary hover:underline"
                          >
                            {item.waybill_number}
                          </Link>
                          {item.waybill_number !== "-" ? (
                            <CopyButton text={item.waybill_number} label="Salin nomor resi" compact showTextInTitle />
                          ) : null}
                        </div>
                        <p className="text-[11px] font-medium text-muted-foreground">
                          {item.carrier_name}
                          {item.service_name ? ` · ${item.service_name}` : ""}
                        </p>
                      </div>
                    </td>

                    {/* Kolom 2: No. Order (Rata Kiri) */}
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-1">
                        <Link
                          href={item.order_href}
                          className="font-mono text-xs font-bold whitespace-nowrap text-foreground hover:text-primary hover:underline"
                        >
                          {item.order_number}
                        </Link>
                        <CopyButton text={item.order_number} label="Salin nomor order" compact showTextInTitle />
                      </div>
                    </td>

                    {/* Kolom 3: No. HP (Rata Kiri) */}
                    <td className="px-3 py-3 align-middle">
                      {item.customer_phone ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs whitespace-nowrap text-foreground">
                            {item.customer_phone}
                          </span>
                          <CopyButton text={item.customer_phone} label="Salin nomor HP" compact showTextInTitle />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Kolom 4: Penerima (nama dan alamat, Rata Kiri) */}
                    <td className="max-w-xs px-4 py-3 align-middle">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-foreground">{item.customer_name}</p>
                        {item.customer_address ? (
                          <p
                            className="line-clamp-3 text-xs leading-relaxed text-muted-foreground"
                            title={item.customer_address}
                          >
                            {item.customer_address}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Alamat belum terisi</p>
                        )}
                      </div>
                    </td>

                    {/* Kolom 5: Status Pengiriman (Rata Tengah) */}
                    <td className="px-3 py-3 text-center align-middle">
                      <div className="inline-flex items-center justify-center">
                        <StatusBadge status={item.status} />
                      </div>
                    </td>

                    {/* Kolom 6: Status Pesanan (Rata Tengah) */}
                    <td className="px-3 py-3 text-center align-middle">
                      {item.order_status ? (
                        <div className="inline-flex items-center justify-center">
                          <StatusBadge status={item.order_status} />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Kolom 7: Update Terakhir (Rata Tengah) */}
                    <td className="px-3 py-3 text-center align-middle">
                      {item.last_status_at ? (
                        <span className="text-xs font-medium text-foreground">
                          {formatDateTime(item.last_status_at)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Kolom 8: Umur pengiriman (Rata Tengah) */}
                    <td className="px-3 py-3 text-center align-middle">
                      {item.age_hours === null ? (
                        <span className="text-xs text-muted-foreground" title={item.age_title}>
                          -
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "text-xs font-medium tabular-nums",
                            item.age_tone === "danger"
                              ? "text-destructive"
                              : item.age_tone === "warning"
                                ? "text-warning-foreground"
                                : "text-foreground",
                          )}
                          title={item.age_title}
                        >
                          {item.age_label}
                        </span>
                      )}
                    </td>

                    {/* Kolom 9: Aksi (Rata Kanan) */}
                    <td className="px-4 py-3 text-right align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button asChild variant="secondary" size="xs">
                          <Link href={item.track_href}>Lacak</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            className="p-8"
            icon="truck"
            title="Belum ada data pengiriman"
            description="Nomor resi pengiriman J&T Cargo yang dicatat untuk pesanan toko akan muncul di tabel ini."
          />
        )}
      </Card>

      {/* Paginasi */}
      <div className="mt-4">
        <Pagination pagination={records} />
      </div>
    </AdminLayout>
  )
}
