import { Head, Link } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/admin/ui/alert"
import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { CopyButton } from "@/components/admin/ui/copy-button"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { PrintCustomerArea, usePrintCustomer } from "@/components/shared/print-customer-detail"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency, formatDate, formatNumber } from "@/lib/format"
import { statusMeta } from "@/lib/status"
import { cn } from "@/lib/utils"

interface CustomerForm {
  id: number
  code: string
  name: string
  phone: string
  default_address_line1?: string | null
  default_address_line2?: string | null
  default_city?: string | null
  default_province?: string | null
  default_postal_code?: string | null
  default_country?: string | null
}

interface Metrics {
  order_count: number
  total_spent: number
  last_order_at: string | null
  status: { key: string; label: string }
  fraud: { score: number; label: string; tone: string }
  name_variants: string[]
  address_variant_count: number
  duplicate_warning: string | null
}

interface OrderRow {
  id: number
  order_number: string
  order_status: string
  payment_status: string
  total_amount: number
  created_at: string | null
  href: string
}

/** Nilai kosong tetap ditampilkan sebagai keterangan, bukan ruang hampa. */
function NilaiKosong() {
  return <span className="text-muted-foreground">Belum ada data</span>
}

/** Satu pasangan label dan nilai. */
function Baris({ label, nilai, mono = false }: { label: string; nilai?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 break-words text-sm text-foreground", mono && "font-mono")}>
        {nilai && nilai.trim() !== "" ? nilai : <NilaiKosong />}
      </dd>
    </div>
  )
}

/** Satu kartu angka ringkasan; bentuknya mengikuti kartu KPI halaman admin lain. */
function KartuAngka({
  label,
  nilai,
  keterangan,
  nada,
  mono = true,
}: {
  label: string
  nilai: string
  keterangan: React.ReactNode
  nada?: string
  mono?: boolean
}) {
  return (
    <Card className="space-y-1 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold", mono ? "font-mono tabular-nums" : "tabular-nums", nada ?? "text-foreground")}>
        {nilai}
      </p>
      <p className="text-[11px] text-muted-foreground">{keterangan}</p>
    </Card>
  )
}

/**
 * Detail pelanggan, READ-ONLY.
 *
 * Data pelanggan adalah cerminan pesanan (ditulis ulang setiap checkout), jadi
 * halaman ini tidak menyediakan mode ubah: koreksi yang diketik di sini akan
 * tertimpa pesanan berikutnya, dan laporan pelanggan jadi menyimpang dari
 * pesanan yang menjadi sumbernya. Data yang salah diperbaiki di pesanannya
 * (keputusan owner 2026-10-05).
 */
export default function CustomerDetail({
  title,
  description,
  customer,
  metrics,
  orders = [],
  backUrl,
  whatsappUrl,
}: {
  title: string
  description: string
  customer: CustomerForm
  metrics: Metrics
  orders: OrderRow[]
  backUrl: string
  whatsappUrl: string
}) {
  const { printing, handlePrint } = usePrintCustomer()

  const nadaPenipuan =
    metrics.fraud.tone === "success"
      ? "text-success"
      : metrics.fraud.tone === "warning"
        ? "text-warning-foreground"
        : metrics.fraud.tone === "danger"
          ? "text-destructive"
          : "text-foreground"

  return (
    <AdminLayout
      title={title}
      description={description}
      backUrl={backUrl}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={metrics.status.key} label={metrics.status.label} />
          <Button asChild variant="secondary" size="sm">
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5">
              <Icon name="whatsapp" className="size-4" aria-hidden="true" />
              <span>Chat WA</span>
            </a>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5"
          >
            <Icon name="printer" className="size-4" aria-hidden="true" />
            <span>Cetak</span>
          </Button>
        </div>
      }
    >
      <Head title={`${customer.name} | Customer | Admin`} />

      {/* Kartu angka ringkasan, mengikuti pola halaman Pembayaran dan Pengiriman. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KartuAngka
          label="Skor penipuan"
          nilai={String(metrics.fraud.score)}
          nada={nadaPenipuan}
          keterangan={metrics.fraud.label}
        />
        <KartuAngka
          label="Jumlah order"
          nilai={formatNumber(metrics.order_count)}
          keterangan="Pesanan dari nomor WhatsApp ini"
        />
        <KartuAngka
          label="Total belanja (fulfillment)"
          nilai={formatCurrency(metrics.total_spent)}
          keterangan="Nilai pesanan yang tercatat"
        />
        <KartuAngka
          label="Order terakhir"
          nilai={metrics.last_order_at ? formatDate(metrics.last_order_at) : "-"}
          mono={false}
          keterangan={metrics.last_order_at ? "Tanggal pesanan terakhir" : "Belum pernah memesan"}
        />
      </div>

      {/* Identitas: satu baris mengalir dari kiri, tanpa kotak yang terlempar
          ke ujung kanan (dulu menyisakan celah kosong lebar di tengah). */}
      <section className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-primary">
            <Icon name="users" className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold">{customer.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1">
                <span className="font-mono text-sm text-muted-foreground">{customer.code}</span>
                <CopyButton text={customer.code} label="Salin ID customer" compact showTextInTitle />
              </span>
              <span className="flex items-center gap-1">
                <span className="font-mono text-sm text-muted-foreground">{customer.phone}</span>
                <CopyButton text={customer.phone} label="Salin nomor HP" compact showTextInTitle />
              </span>
            </div>
          </div>
        </div>

        {metrics.duplicate_warning ? (
          <Alert tone="warning" className="mt-4">
            {metrics.duplicate_warning}
          </Alert>
        ) : null}
        {metrics.fraud.score >= 30 ? (
          <p className="mt-4 text-sm font-semibold text-warning-foreground">Nomor WhatsApp sedang diselidiki</p>
        ) : null}
      </section>

      {/* Alamat kirim: dua kolom, setiap baris terisi penuh. Nama dan nomor
          tidak diulang di sini karena sudah tampil di kartu identitas. */}
      <SectionCard
        title="Alamat Pengiriman"
        description="Alamat yang tercatat dari pesanan terakhir pemesan ini."
        className="mt-6"
      >
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Baris label="Alamat" nilai={customer.default_address_line1} />
          </div>
          <Baris label="Kota" nilai={customer.default_city} />
          <Baris label="Provinsi" nilai={customer.default_province} />
          <Baris label="Kode pos" nilai={customer.default_postal_code} />
          <Baris label="Negara" nilai={customer.default_country} />
        </dl>

        <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          Data ini mengikuti pesanan terakhir pemesan ini dan diperbarui sendiri setiap ada pesanan baru, jadi tidak
          bisa diubah dari sini. Bila ada yang perlu dikoreksi, perbaikannya di pesanannya.
        </p>
      </SectionCard>

      {/* Riwayat pesanan: tabel membentang penuh. */}
      <SectionCard
        title="Riwayat Pesanan"
        description={orders.length ? `${formatNumber(orders.length)} pesanan tercatat.` : undefined}
        className="mt-6"
        contentClassName="p-0"
      >
        {orders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface/80 text-left text-[11px] font-semibold text-muted-foreground">
                  <th className="w-10 px-4 py-3 text-right">No</th>
                  <th className="px-4 py-3">Nomor pesanan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order, index) => (
                  <tr key={order.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 text-right align-middle tabular-nums text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-1">
                        <Link href={order.href} className="font-semibold text-primary hover:underline">
                          {order.order_number}
                        </Link>
                        <CopyButton text={order.order_number} label="Salin nomor order" compact showTextInTitle />
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">
                      {statusMeta(order.order_status).label} · {statusMeta(order.payment_status).label}
                    </td>
                    <td className="px-4 py-3 text-right align-middle font-semibold tabular-nums">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">
                      {order.created_at ? formatDate(order.created_at) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">Belum ada pesanan.</p>
        )}
      </SectionCard>

      {printing ? (
        <PrintCustomerArea
          data={{
            customer,
            metrics,
            orders,
          }}
        />
      ) : null}
    </AdminLayout>
  )
}
