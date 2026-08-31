import { Head, Link } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/public/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { TrustAssuranceCard } from "@/components/public/trust-assurance-card"
import PublicLayout from "@/layouts/public-layout"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { PublicOrder } from "@/types"

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      type="button"
      aria-label={`Salin ${label}`}
      title={`Salin ${label}`}
      onClick={() => {
        if (navigator.clipboard) void navigator.clipboard.writeText(text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      }}
      className="ml-1 inline-flex size-4 shrink-0 items-center justify-center rounded align-middle text-muted-foreground transition-colors hover:text-primary"
    >
      <Icon name={copied ? "check" : "copy"} className="size-3.5" aria-hidden="true" />
    </button>
  )
}

function paymentLabel(order: PublicOrder): string {
  if (order.payment_method === "cod") return "COD"
  return order.payment_status === "paid" ? "Transfer (lunas)" : "Transfer"
}

function OrderCard({ order }: { order: PublicOrder }) {
  const [open, setOpen] = React.useState(false)
  const totalUnits = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
  const toggleId = `order-card-toggle-${order.order_number}`
  const waybill = order.shipping?.waybill_number
  const resiText = waybill || "Belum Dikirim"

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-primary/40">
      {/* Header: no order (merah) + tanggal + resi | status badge */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-all font-mono text-sm font-bold text-primary">
              No. Order {order.order_number}
              <CopyButton text={order.order_number} label="No. Order" />
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {order.created_at ? formatDateTime(order.created_at) : ""}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <span>Resi {resiText}</span>
              {waybill ? <CopyButton text={waybill} label="Nomor Resi" /> : null}
            </p>
          </div>
          <StatusBadge status={order.vm?.primaryStatus?.key ?? order.order_status} />
        </div>
      </div>
      <div className="mx-4 h-px bg-border" />

      {/* Total unit (dropdown toggle) + nilai pesanan + metode pembayaran */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={toggleId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted"
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
          Total {totalUnits} unit
          <Icon
            name="chevron-down"
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="tabular-nums text-sm font-bold text-primary">
            {formatCurrency(order.total_amount)}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">
            {paymentLabel(order)}
          </span>
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
          <ul>
            {order.items.map((item, index) => {
              const unit = item.line_total ? Number(item.line_total) / item.quantity : null
              return (
                <React.Fragment key={`${item.product_name ?? item.name}-${index}`}>
                  <li className="flex items-center gap-3 px-4 py-3">
                    <span className="relative flex size-12 min-w-12 flex-none items-center justify-center overflow-hidden rounded-[5px] border border-border bg-surface-muted">
                      <ResponsiveImage
                        src={item.image ?? null}
                        alt={item.product_name ?? item.name ?? "Produk"}
                        wrapperClassName="size-full"
                        className="size-full object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      {item.parent_sku ? (
                        <Link
                          href={routeUrl("product.show", { parent_sku: item.parent_sku })}
                          className="block truncate text-xs font-semibold text-foreground hover:text-primary"
                        >
                          {item.product_name ?? item.name}
                        </Link>
                      ) : (
                        <span className="block truncate text-xs font-semibold text-foreground">
                          {item.product_name ?? item.name}
                        </span>
                      )}
                      {item.variant_label ? (
                        <span className="mt-0.5 block break-words text-[11px] text-muted-foreground">
                          {item.variant_label}
                        </span>
                      ) : null}
                      {item.note ? (
                        <span className="mt-0.5 block break-words text-[11px] text-muted-foreground">
                          Catatan: {item.note}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block tabular-nums text-xs font-semibold text-foreground">
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
                  {index < order.items.length - 1 ? (
                    <li aria-hidden="true" className="mx-4 h-px bg-border" />
                  ) : null}
                </React.Fragment>
              )
            })}
          </ul>
        </div>
      </div>

      {/* Divider inset + tombol Detail Pesanan */}
      <div className="mx-4 h-px bg-border" />
      <div className="p-4">
        <Button asChild variant="secondary" size="md" className="w-full">
          <Link href={routeUrl("order.status")}>Detail Pesanan</Link>
        </Button>
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

      <section className="container-page !px-2.5 md:!px-8 lg:!px-12 pt-4">
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

      {/* CTA Kepercayaan — reuse komponen bersama (sama dengan Cart/Checkout) */}
      <section className="container-page !px-2.5 md:!px-8 lg:!px-12 pb-[calc(var(--mobile-bottom-nav-height)+1rem)] pt-6 lg:pb-8">
        <TrustAssuranceCard />
      </section>
    </PublicLayout>
  )
}