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
import { routeUrl } from "@/lib/routes"
import type { PublicOrder } from "@/types"

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
                <Link
                  href={routeUrl("order.status")}
                  className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-surface-muted"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-sm font-semibold text-foreground">
                        {order.order_number}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {order.created_at ? formatDate(order.created_at) : ""}
                      </p>
                    </div>
                    <StatusBadge status={order.order_status} />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">
                      {order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)} item
                    </span>
                    <span className="tabular-nums text-sm font-bold text-foreground">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon name="map-pin" className="size-3.5 shrink-0" aria-hidden="true" />
                    {order.shipping?.carrier_name && order.shipping.waybill_number ? (
                      <span className="truncate">
                        {order.shipping.carrier_name} · Resi {order.shipping.waybill_number}
                      </span>
                    ) : (
                      <span>Lihat status & pengiriman pesanan ini</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PublicLayout>
  )
}