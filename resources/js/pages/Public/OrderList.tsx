import { Head, Link } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/public/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import PublicLayout from "@/layouts/public-layout"
import { formatCurrency, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { PublicOrder } from "@/types"

function orderFooterNote(order: PublicOrder): string {
  const s = order.order_status
  if (s === "completed") return "Pesanan Anda telah selesai, terimakasih."
  if (s === "delivered") return "Paket sudah diterima. Terimakasih telah berbelanja."
  if (s === "shipped") return "Pesanan sedang dalam perjalanan menuju alamat Anda."
  if (s === "processing") return "Pesanan sedang diproses admin gudang."
  return order.payment_method === "cod"
    ? "Pesanan diterima dan masuk antrean produksi. Bayar di tempat saat kurir tiba."
    : "Pesanan dibuat. Silakan selesaikan pembayaran sesuai instruksi."
}

function OrderCard({ order }: { order: PublicOrder }) {
  const [open, setOpen] = React.useState(false)
  const totalUnits = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
  const toggleId = `order-card-toggle-${order.order_number}`

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-primary/40">
      {/* Header: no order (merah) + tanggal | status badge */}
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="break-all font-mono text-sm font-bold text-primary">
            No. Order {order.order_number}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {order.created_at ? formatDate(order.created_at) : ""}
          </p>
        </div>
        <StatusBadge status={order.order_status} />
      </div>
      <div className="h-px w-full bg-border" />

      {/* Total unit (dropdown toggle) + nilai pesanan */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={toggleId}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-muted"
      >
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Icon
            name={open ? "chevron-down" : "chevron-right"}
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
            aria-hidden="true"
          />
          Total {totalUnits} unit
        </span>
        <span className="tabular-nums text-base font-bold text-primary">
          {formatCurrency(order.total_amount)}
        </span>
      </button>

      {/* Item pesanan (dropdown, kolaps default) */}
      <div
        id={toggleId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <ul className="divide-y divide-border border-t border-border">
            {order.items.map((item, index) => {
              const unit = item.line_total ? Number(item.line_total) / item.quantity : null
              return (
                <li
                  key={`${item.product_name ?? item.name}-${index}`}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="flex size-12 min-w-12 flex-none items-center justify-center rounded-lg bg-surface-muted text-xs font-semibold text-muted-foreground">
                    {item.quantity}x
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">
                      {item.product_name ?? item.name}
                    </span>
                    {item.note ? (
                      <span className="mt-0.5 block break-words text-[11px] text-muted-foreground">
                        Catatan: {item.note}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block tabular-nums text-[13px] font-semibold text-foreground">
                      {item.line_total
                        ? formatCurrency(item.line_total)
                        : `${item.quantity} item`}
                    </span>
                    {unit !== null ? (
                      <span className="mt-0.5 block tabular-nums text-[11px] text-muted-foreground">
                        {item.quantity} × {formatCurrency(unit)}
                      </span>
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {/* Footer note status */}
      <div className="border-t border-border px-4 py-3">
        <p className="text-[11px] text-muted-foreground">{orderFooterNote(order)}</p>
      </div>
    </div>
  )
}

export default function OrderList({
  orders = [],
  has_session_orders = false,
}: {
  orders?: PublicOrder[]
  has_session_orders?: boolean
}) {
  const noOrders = !has_session_orders || orders.length === 0

  return (
    <PublicLayout>
      <Head title="Pesanan Saya" />

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden md:block py-2 !px-2.5 md:!px-8 lg:!px-12">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Pesanan Saya", href: null },
            ]}
          />
        </div>
        <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
          <PageHeader title="Pesanan Saya" container={false} className="border-b-0" />
        </div>
      </section>

      <section className="container-page !px-2.5 md:!px-8 lg:!px-12 pt-4 pb-[calc(var(--mobile-bottom-nav-height)+1rem)] lg:pb-8">
        {noOrders ? (
          <EmptyState
            icon="clipboard-list"
            title="Belum ada pesanan"
            description="Pesanan yang tersimpan di perangkat ini akan tampil di sini. Belum pernah memesan? Mulai dari katalog produk kami."
            action={
              <Button asChild variant="secondary">
                <Link href={routeUrl("catalog.index")}>Belanja Sekarang</Link>
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {orders.map((order) => (
              <li key={order.order_number}>
                <OrderCard order={order} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PublicLayout>
  )
}