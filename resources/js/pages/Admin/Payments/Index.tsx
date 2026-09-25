import { Head, Link, router, useForm } from "@inertiajs/react"
import { navigateFilter } from "@/lib/filter-url"
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"

import { Button } from "@/components/admin/ui/button"
import { CopyButton } from "@/components/admin/ui/copy-button"
import { Card } from "@/components/admin/ui/card"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Field } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface PaymentItem {
  id: number
  order_id: number | null
  order_number: string
  order_status: string | null
  customer_name: string
  customer_phone: string
  whatsapp_url: string | null
  payment_method: string
  payment_method_label: string
  status: string
  status_label: string
  amount: number
  transaction_reference: string | null
  evidence_url: string | null
  paid_at: string | null
  created_at: string
  order_href: string
}

export interface PaymentSummary {
  total_received: number
  completed_count: number
  transfer_paid: number
  transfer_count: number
  cod_paid: number
  cod_count: number
  pending_amount: number
  pending_count: number
}

export interface StatusTab {
  key: string
  label: string
  count: number
}

export interface BankTransferDetails {
  bank_name: string
  account_name: string
  account_number: string
  notes: string
}

export interface PaymentsIndexProps {
  title: string
  description?: string
  bankTransfer?: BankTransferDetails | null
  bankUpdateUrl?: string
  summary: PaymentSummary
  tabs: StatusTab[]
  activeStatus: string
  activeMethod: string
  searchQuery: string
  activeDatePreset: string
  dateFrom: string
  dateTo: string
  periodLabel: string
  payments: {
    data: PaymentItem[]
    links: Array<{ url: string | null; label: string; active: boolean }>
    from: number | null
    to: number | null
    total: number
    per_page: number
    current_page: number
    last_page: number
  }
}


export default function PaymentsIndex({
  title,
  description,
  bankTransfer,
  bankUpdateUrl,
  summary,
  tabs,
  activeStatus,
  activeMethod,
  searchQuery,
  activeDatePreset,
  dateFrom: initialDateFrom,
  dateTo: initialDateTo,
  periodLabel,
  payments,
}: PaymentsIndexProps) {
  const [refreshing, setRefreshing] = React.useState(false)
  const [q, setQ] = React.useState(searchQuery)
  const [rangeFrom, setRangeFrom] = React.useState(initialDateFrom)
  const [rangeTo, setRangeTo] = React.useState(initialDateTo)
  // Rekening tampil read-only; form hanya aktif setelah admin menekan Ubah/Atur.
  const [bankEditing, setBankEditing] = React.useState(false)
  const bankForm = useForm({
    bank_name: bankTransfer?.bank_name ?? "",
    account_number: bankTransfer?.account_number ?? "",
    account_name: bankTransfer?.account_name ?? "",
    notes: bankTransfer?.notes ?? "",
  })
  const [evidencePreviewUrl, setEvidencePreviewUrl] = React.useState<string | null>(null)
  const [evidenceLoadError, setEvidenceLoadError] = React.useState(false)

  // Sudah ada rekening terisi? Kalau belum, tampilkan ajakan mengatur.
  const hasBankDetails = Boolean(
    bankTransfer?.bank_name?.trim() ||
      bankTransfer?.account_number?.trim() ||
      bankTransfer?.account_name?.trim(),
  )

  function visit(params: Record<string, string | undefined>) {
    navigateFilter(
      "admin.payments.index",
      { status: activeStatus, method: activeMethod, q: searchQuery, date_preset: activeDatePreset, date_from: activeDatePreset === "range" ? rangeFrom : undefined, date_to: activeDatePreset === "range" ? rangeTo : undefined },
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
        "Rekonsiliasi transaksi pembayaran toko, verifikasi transfer bank, dan penerimaan COD."
      }
      actions={actions}
    >
      <Head title={`${title} | Admin`} />

      {/* 4 Kartu KPI Ringkasan Kas */}
      <p className="mb-2 text-[11px] font-medium text-muted-foreground">
        Ringkasan kas · {periodLabel}
      </p>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4 space-y-1 bg-card">
          <p className="text-xs font-medium text-muted-foreground">Total Kas Diterima</p>
          <p className="font-mono text-lg font-bold tabular-nums text-foreground">
            {formatCurrency(summary.total_received)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatNumber(summary.completed_count)} transaksi lunas terverifikasi
          </p>
        </Card>

        <Card className="p-4 space-y-1 bg-card">
          <p className="text-xs font-medium text-muted-foreground">Transfer Bank Lunas</p>
          <p className="font-mono text-lg font-bold tabular-nums text-foreground">
            {formatCurrency(summary.transfer_paid)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatNumber(summary.transfer_count)} transfer terverifikasi admin
          </p>
        </Card>

        <Card className="p-4 space-y-1 bg-card">
          <p className="text-xs font-medium text-muted-foreground">COD Selesai</p>
          <p className="font-mono text-lg font-bold tabular-nums text-foreground">
            {formatCurrency(summary.cod_paid)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatNumber(summary.cod_count)} paket sudah sampai ke pembeli
          </p>
        </Card>

        <Card className="p-4 space-y-1 bg-card">
          <p className="text-xs font-medium text-muted-foreground">Menunggu Pelunasan</p>
          <p className="font-mono text-lg font-bold tabular-nums text-warning-foreground">
            {formatCurrency(summary.pending_amount)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatNumber(summary.pending_count)} tagihan pending atau COD di jalan
          </p>
        </Card>
      </div>

      {/* Detail Rekening Bank Transfer - read only sampai admin menekan Ubah */}
      <Card className="mb-4 p-5 bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Rekening Transfer Bank</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Dipakai pada pesan WhatsApp instruksi transfer dan halaman konfirmasi pesanan
              pembeli dengan metode transfer.
            </p>
          </div>
          {!bankEditing && hasBankDetails ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setBankEditing(true)}
            >
              <Icon name="pencil" className="size-3.5" aria-hidden="true" />
              Ubah
            </Button>
          ) : null}
        </div>

        {bankEditing ? (
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault()
              bankForm.put(bankUpdateUrl ?? "", {
                preserveScroll: true,
                onSuccess: () => setBankEditing(false),
              })
            }}
          >
            <Field id="bank_name" label="Nama Bank" required error={bankForm.errors.bank_name}>
              <Input
                id="bank_name"
                value={bankForm.data.bank_name}
                onChange={(event) => bankForm.setData("bank_name", event.target.value)}
                placeholder="cth. BCA"
                required
              />
            </Field>
            <Field id="account_number" label="No. Rekening" required error={bankForm.errors.account_number}>
              <Input
                id="account_number"
                value={bankForm.data.account_number}
                onChange={(event) => bankForm.setData("account_number", event.target.value)}
                placeholder="cth. 1234567890"
                className="font-mono"
                required
              />
            </Field>
            <Field id="account_name" label="Atas Nama" required error={bankForm.errors.account_name}>
              <Input
                id="account_name"
                value={bankForm.data.account_name}
                onChange={(event) => bankForm.setData("account_name", event.target.value)}
                placeholder="cth. Ragil Aluminium"
                required
              />
            </Field>
            <Field id="notes" label="Catatan Transfer (opsional)" error={bankForm.errors.notes}>
              <Input
                id="notes"
                value={bankForm.data.notes}
                onChange={(event) => bankForm.setData("notes", event.target.value)}
                placeholder="Instruksi tambahan untuk pembeli"
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2 xl:col-span-4">
              <Button type="submit" disabled={bankForm.processing}>
                {bankForm.processing ? "Menyimpan..." : "Simpan Rekening"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={bankForm.processing}
                onClick={() => {
                  // Buang perubahan yang belum disimpan supaya nilai lama tidak
                  // tertinggal di form saat dibuka lagi.
                  bankForm.setData({
                    bank_name: bankTransfer?.bank_name ?? "",
                    account_number: bankTransfer?.account_number ?? "",
                    account_name: bankTransfer?.account_name ?? "",
                    notes: bankTransfer?.notes ?? "",
                  })
                  bankForm.clearErrors()
                  setBankEditing(false)
                }}
              >
                Batal
              </Button>
            </div>
          </form>
        ) : hasBankDetails ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Nama Bank", value: bankTransfer?.bank_name, mono: false },
              { label: "No. Rekening", value: bankTransfer?.account_number, mono: true },
              { label: "Atas Nama", value: bankTransfer?.account_name, mono: false },
              { label: "Catatan Transfer", value: bankTransfer?.notes, mono: false },
            ].map((item) => (
              <div key={item.label} className="min-w-0">
                <dt className="text-[13px] font-medium text-muted-foreground">{item.label}</dt>
                <dd
                  className={cn(
                    "mt-1 truncate text-sm font-semibold text-foreground",
                    item.mono && "font-mono",
                  )}
                  title={item.value || undefined}
                >
                  {item.value?.trim() ? item.value : "-"}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Rekening belum diatur. Pembeli dengan metode transfer belum menerima instruksi pembayaran.
            </p>
            <Button type="button" size="sm" onClick={() => setBankEditing(true)}>
              Atur rekening
            </Button>
          </div>
        )}
      </Card>

      {/* Tabs status pembayaran */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 scrollbar-none overflow-x-auto">
          <div
            className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-1"
            role="tablist"
            aria-label="Filter status pembayaran"
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
            Total Tercatat:{" "}
            <strong className="tabular-nums font-semibold text-foreground">
              {formatCurrency(summary.total_received + summary.pending_amount)}
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
          placeholder: "Cari nomor order, nama pembeli, no. HP, atau referensi transaksi...",
        }}
        className="mb-4 pb-[10px]"
      >
        <Select
          value={activeMethod || "all"}
          onChange={(event) =>
            visit({ method: event.target.value === "all" ? undefined : event.target.value })
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
          aria-label="Filter periode pembayaran"
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
          <span className="text-[11px] font-medium text-muted-foreground">
            Periode
          </span>
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

      {/* Tabel Pembayaran Table-First Desktop */}
      <Card className="overflow-hidden border border-border bg-card">
        {payments.data.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface/80 text-[11px] font-semibold text-muted-foreground">
                  <th className="px-4 py-3 text-left">Pesanan & Pelanggan</th>
                  <th className="px-3 py-3 text-center">Metode</th>
                  <th className="px-3 py-3 text-center">Status Pembayaran</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                  <th className="px-3 py-3 text-center">Waktu Transaksi</th>
                  <th className="px-3 py-3 text-center">Bukti Bayar</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.data.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-muted/40">
                    {/* Kolom 1: Pesanan & Pelanggan (Rata Kiri) */}
                    <td className="px-4 py-3 align-middle">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={item.order_href}
                            className="font-mono text-sm font-bold tracking-tight text-foreground hover:text-primary hover:underline"
                          >
                            {item.order_number}
                          </Link>
                          <CopyButton text={item.order_number} label="Salin nomor order" />
                          {item.order_status ? (
                            <StatusBadge status={item.order_status} />
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{item.customer_name}</span>
                          {item.customer_phone ? (
                            <span className="inline-flex items-center gap-1">
                              <span>·</span>
                              <span className="font-mono text-[11px]">{item.customer_phone}</span>
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
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    {/* Kolom 2: Metode (Rata Tengah) */}
                    <td className="px-3 py-3 text-center align-middle">
                      <div className="space-y-0.5">
                        <span className="inline-flex min-h-6 items-center rounded-md border border-border bg-surface px-2 py-0.5 font-semibold text-foreground">
                          {item.payment_method_label}
                        </span>
                        {item.transaction_reference ? (
                          <p className="font-mono text-[11px] text-muted-foreground">
                            Ref: {item.transaction_reference}
                          </p>
                        ) : null}
                      </div>
                    </td>

                    {/* Kolom 3: Status Pembayaran (Rata Tengah) */}
                    <td className="px-3 py-3 text-center align-middle">
                      <div className="inline-flex items-center justify-center">
                        <StatusBadge status={item.status} label={item.status_label} />
                      </div>
                    </td>

                    {/* Kolom 4: Nominal (Rata Kanan) */}
                    <td className="px-4 py-3 text-right align-middle">
                      <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                        {formatCurrency(item.amount)}
                      </span>
                    </td>

                    {/* Kolom 5: Waktu Transaksi (Rata Tengah) */}
                    <td className="px-3 py-3 text-center align-middle">
                      {item.paid_at ? (
                        <div className="space-y-0.5">
                          <span className="text-xs font-medium text-foreground">
                            {formatDateTime(item.paid_at)}
                          </span>
                          <p className="text-[11px] text-success">Lunas</p>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(item.created_at)}
                          </span>
                          <p className="text-[11px] text-muted-foreground">Dibuat</p>
                        </div>
                      )}
                    </td>

                    {/* Kolom 6: Bukti Bayar (Rata Tengah) */}
                    <td className="px-3 py-3 text-center align-middle">
                      {item.evidence_url ? (
                        <button
                          type="button"
                          onClick={() => { setEvidenceLoadError(false); setEvidencePreviewUrl(item.evidence_url); }}
                          className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-[11px] font-medium text-primary hover:bg-muted"
                        >
                          <Icon name="image" className="size-3" aria-hidden="true" />
                          <span>Lihat bukti</span>
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Kolom 7: Aksi (Rata Kanan) */}
                    <td className="px-4 py-3 text-right align-middle">
                      <Button asChild variant="secondary" size="xs">
                        <Link href={item.order_href}>Detail pesanan</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            className="p-8"
            icon="hand-coins"
            title="Belum ada transaksi pembayaran"
            description="Transaksi pembayaran transfer bank atau COD yang tercatat akan muncul di tabel ini."
          />
        )}
      </Card>

      {/* Paginasi */}
      <div className="mt-4">
        <Pagination pagination={payments} />
      </div>

      {/* Dialog Preview Bukti Bayar */}
      <DialogPrimitive.Root
        open={Boolean(evidencePreviewUrl)}
        onOpenChange={(open) => {
          if (!open) setEvidencePreviewUrl(null)
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-[80] flex max-h-[min(90dvh,42rem)] w-[min(calc(100%-2rem),36rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl duration-200",
              "data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95",
            )}
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className="sr-only">Bukti Transfer Pembayaran</DialogPrimitive.Title>

            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Bukti Transfer Pembayaran</h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  Struk bukti transfer bank pelanggan
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEvidencePreviewUrl(null)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Tutup preview bukti"
              >
                <Icon name="x" className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex items-center justify-center bg-muted/20 min-h-[16rem]">
              {evidencePreviewUrl ? (
                evidenceLoadError ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <Icon name="image" className="size-8 text-muted-foreground/40 mb-2" aria-hidden="true" />
                    <p className="text-xs font-medium text-foreground">Gambar bukti transfer tidak dapat dimuat</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Tautan mungkin telah kedaluwarsa atau file fisik telah dipindahkan.</p>
                  </div>
                ) : (
                  <img
                    src={evidencePreviewUrl}
                    alt="Bukti Transfer"
                    onError={() => setEvidenceLoadError(true)}
                    className="max-h-[30rem] w-auto max-w-full rounded-lg object-contain shadow-md"
                  />
                )
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              {evidencePreviewUrl ? (
                <Button asChild variant="secondary" size="sm">
                  <a href={evidencePreviewUrl} target="_blank" rel="noreferrer">
                    <Icon name="arrow-up-right" className="size-3.5" aria-hidden="true" />
                    <span>Buka tab baru</span>
                  </a>
                </Button>
              ) : null}
              <Button type="button" size="sm" onClick={() => setEvidencePreviewUrl(null)}>
                Tutup
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </AdminLayout>
  )
}
