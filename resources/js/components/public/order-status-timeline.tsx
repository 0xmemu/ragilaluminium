import { Link } from "@inertiajs/react"

import { StatusBadge } from "@/components/ui/status-badge"
import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

const STEPS = [
  {
    label: "Pesanan",
    description: "Pencatatan dan proses item",
    icon: "clipboard-list",
    key: "order_status" as const,
  },
  {
    label: "Pembayaran",
    description: "Pencatatan pembayaran",
    icon: "credit-card",
    key: "payment_status" as const,
  },
  {
    label: "Pengiriman",
    description: "Persiapan dan perjalanan",
    icon: "truck",
    key: "shipping_status" as const,
  },
]

export function OrderStatusTimeline({
  orderStatus,
  paymentStatus,
  shippingStatus,
  className,
}: {
  orderStatus: string | null | undefined
  paymentStatus: string | null | undefined
  shippingStatus: string | null | undefined
  className?: string
}) {
  const statuses = {
    order_status: orderStatus,
    payment_status: paymentStatus,
    shipping_status: shippingStatus,
  }

  return (
    <ol className={cn("grid gap-3 md:grid-cols-3", className)}>
      {STEPS.map((step, index) => (
        <li key={step.label} className="relative rounded-lg border border-border bg-surface p-5">
          {index < STEPS.length - 1 ? (
            <span
              className="absolute -right-3 top-9 z-10 hidden h-px w-3 bg-border md:block"
              aria-hidden="true"
            />
          ) : null}
          <Icon name={step.icon} className="h-5 w-5 text-primary" aria-hidden="true" />
          <p className="mt-4 text-sm font-semibold">{step.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
          <div className="mt-4">
            <StatusBadge status={statuses[step.key]} />
          </div>
        </li>
      ))}
    </ol>
  )
}

export function OrderStatusTimelineLink({
  href,
  label = "Cek Status Lengkap",
}: {
  href: string
  label?: string
}) {
  return (
    <Link href={href} className="text-sm font-semibold text-primary hover:underline">
      {label}
    </Link>
  )
}
