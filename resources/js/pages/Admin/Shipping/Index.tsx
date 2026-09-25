import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { CopyButton } from "@/components/admin/ui/copy-button"
import { Card } from "@/components/admin/ui/card"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { formatDateTime, formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"

export interface ShippingItem {
  id: number
  waybill_number: string
  carrier_name: string
  service_name: string | null
  status: string
  status_raw: string | null
  last_status_at: string | null
  order_id: number | null
  order_number: string
  order_status: string | null
  customer_name: string
  customer_phone: string
  customer_city: string
  whatsapp_url: string | null
  href: string
  order_href: string
  refresh_url: string
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
  activeCarrier: string
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
  activeCarrier,
  searchQuery,
  records,
}: ShippingIndexProps) {
  const [refreshing, setRefreshing] = React.useState(false)
  const [busyRowId, setBusyRowId] = React.useState<number | null>(null)
  const [q, setQ] = React.useState(searchQuery)

  function visit(params: Record<string, string | undefined>) {
    const next: Record<string, string> = {}
    const merged = {
      status: activeStatus,
      carrier_name: activeCarrier,
      q: searchQuery,
      ...params,
    }
    Object.entries(merged).forEach(([key, value]) => {
      if (!value || value === "all") return
      if (key === "q" && !value.trim()) return
      next[key] = value
    })
    router.get(routeUrl("admin.shipping.index"), next, {
      preserveState: true,
      preserveScroll: true,
      replace: true,
    })
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    visit({ q: q.trim() })
  }

  function refreshSingle(item: ShippingItem) {
    setBusyRowId(item.id)
    router.post(
      item.refresh_url,
      {},
      {
        preserveScroll: true,
        onFinish: () => setBusyRowId(null),
      },
    )
  }

  const actions = (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={refreshing}
        onClick={() => {
          setRefreshing(true)
          router.reload({
            onFinish: () => setRefreshing(false),
          })
        }}
        className="inline-flex items-center gap-1.5"
      >
        <Icon
          name="refresh"
          className={cn("size-3.5", refreshing ? "animate-spin" : "")}
          aria-hidden="true"
        />
        <span>{refreshing ? "Memuat..." : "Muat ulang"}</span>
      </Button>
    </div>
  )

  return (
    <AdminLayout
      title={title}
      description={
        description ??
        "Monitoring paket ekspedisi J&T Cargo, pelacakan resi, dan serah terima pengiriman pelanggan."
      }
      actions={actions}
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
          <p className="font-mono text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
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
          value={activeCarrier || "all"}
          onChange={(event) =>
            visit({ carrier_name: event.target.value === "all" ? undefined : event.target.value })
          }
          className="w-auto"
          aria-label="Filter kurir ekspedisi"
        >
          <option value="all">Semua kurir</option>
          <option value="J&T Cargo">J&T Cargo</option>
        </Select>
      </ListToolbar>

      {/* Tabel Pengiriman Table-First Desktop */}
      <Card className="overflow-hidden border border-border bg-card">
        {records.data.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface/80 text-[11px] font-semibold text-muted-foreground">
                  <th className="px-4 py-3 text-left">Resi & Kurir</th>
                  <th className="px-4 py-3 text-left">Pesanan & Tujuan</th>
                  <th className="px-3 py-3 text-center">Status Pengiriman</th>
                  <th className="px-3 py-3 text-center">Status Pesanan</th>
                  <th className="px-3 py-3 text-center">Update Terakhir</th>
                  <th className="px-4 py-3 text-left">Keterangan Kurir</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
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
                            href={item.href}
                            className="font-mono text-sm font-bold tracking-tight text-foreground hover:text-primary hover:underline"
                          >
                            {item.waybill_number}
                          </Link>
                          {item.waybill_number !== "-" ? (
                            <CopyButton text={item.waybill_number} label="Salin nomor resi" />
                          ) : null}
                        </div>
                        <p className="text-[11px] font-medium text-muted-foreground">
                          {item.carrier_name}
                          {item.service_name ? ` · ${item.service_name}` : ""}
                        </p>
                      </div>
                    </td>

                    {/* Kolom 2: Pesanan & Tujuan (Rata Kiri) */}
                    <td className="px-4 py-3 align-middle">
                      <div className="space-y-1">
                        <Link
                          href={item.order_href}
                          className="font-mono text-xs font-bold text-foreground hover:text-primary hover:underline"
                        >
                          {item.order_number}
                        </Link>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{item.customer_name}</span>
                          {item.customer_city ? (
                            <span>({item.customer_city})</span>
                          ) : null}
                          {item.whatsapp_url ? (
                            <a
                              href={item.whatsapp_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-success hover:opacity-80"
                              title="Chat WhatsApp pembeli"
                            >
                              <Icon name="whatsapp" className="size-3 text-success" aria-hidden="true" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    {/* Kolom 3: Status Pengiriman (Rata Tengah) */}
                    <td className="px-3 py-3 text-center align-middle">
                      <div className="inline-flex items-center justify-center">
                        <StatusBadge status={item.status} />
                      </div>
                    </td>

                    {/* Kolom 4: Status Pesanan (Rata Tengah) */}
                    <td className="px-3 py-3 text-center align-middle">
                      {item.order_status ? (
                        <div className="inline-flex items-center justify-center">
                          <StatusBadge status={item.order_status} />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Kolom 5: Update Terakhir (Rata Tengah) */}
                    <td className="px-3 py-3 text-center align-middle">
                      {item.last_status_at ? (
                        <span className="text-xs font-medium text-foreground">
                          {formatDateTime(item.last_status_at)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Kolom 6: Keterangan Kurir (Rata Kiri) */}
                    <td className="max-w-xs px-4 py-3 align-middle">
                      {item.status_raw ? (
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground" title={item.status_raw}>
                          {item.status_raw}
                        </p>
                      ) : (
                        <span className="text-xs text-muted-foreground">Belum ada keterangan</span>
                      )}
                    </td>

                    {/* Kolom 7: Aksi (Rata Kanan) */}
                    <td className="px-4 py-3 text-right align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          disabled={busyRowId === item.id}
                          onClick={() => refreshSingle(item)}
                          className="inline-flex items-center gap-1 text-xs"
                          title="Perbarui status dari J&T Cargo"
                        >
                          <Icon
                            name="refresh"
                            className={cn("size-3", busyRowId === item.id ? "animate-spin" : "")}
                            aria-hidden="true"
                          />
                          <span>{busyRowId === item.id ? "Memuat..." : "Refresh"}</span>
                        </Button>
                        <Button asChild variant="secondary" size="xs">
                          <Link href={item.href}>Lacak</Link>
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
