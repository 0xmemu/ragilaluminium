import * as React from "react"
import { Link } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { StatusBadge } from "@/components/ui/status-badge"
import { CustomerReviewForm } from "@/components/public/customer-review-form"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { formatCurrency, formatDateTime, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { PublicOrder } from "@/types"

/**
 * Detail tracking order ready-stock, dibangun dari OrderTrackingViewModel (vm).
 * UI membaca dari vm sebagai satu sumber kebenaran; tidak menghitung status sendiri.
 *
 * Urutan section (mobile-first, card-light):
 * identity -> action banner -> status hero -> milestone -> current detail ->
 * estimate -> recipient -> carrier -> expandable timeline -> items -> payment -> support.
 */

function StatusHero({ order }: { order: PublicOrder }) {
  const vm = order.vm
  const primary = vm?.primaryStatus
  if (!primary) return null
  return (
    <div className="order-tracking__status-hero border-b border-border pb-5" aria-live="polite">
      <div className="flex items-center gap-2">
        <StatusBadge status={order.order_status} />
      </div>
      <h2 className="mt-3 text-xl font-bold tracking-tight text-foreground">{primary.headline}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{primary.message}</p>
      {primary.updatedAt ? (
        <p className="mt-2 text-xs text-muted-foreground/70">
          Terakhir diperbarui {formatDateTime(primary.updatedAt)}
        </p>
      ) : null}
    </div>
  )
}

function Milestones({ order }: { order: PublicOrder }) {
  const milestones = order.vm?.milestones
  if (!milestones || milestones.length === 0) return null

  return (
    <ol className="order-tracking__milestones space-y-0">
      {milestones.map((step, index) => {
        const isLast = index === milestones.length - 1
        const connector = !isLast ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-0.5",
              step.state === "completed" || step.state === "current" ? "bg-primary/50" : "bg-border",
            )}
          />
        ) : null

        return (
          <li key={step.key + index} className="relative flex gap-3 pb-5 last:pb-0">
            {connector}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                step.state === "completed" && "border-primary bg-primary text-primary-foreground",
                step.state === "current" && "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15",
                step.state === "upcoming" && "border-border bg-surface text-muted-foreground",
                step.state === "exception" && "border-warning bg-warning/10 text-warning",
              )}
            >
              {step.state === "completed" ? (
                <Icon name="check" className="size-3.5" weight="bold" />
              ) : step.state === "exception" ? (
                <Icon name="warning" className="size-3.5" weight="bold" />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  "text-sm font-semibold",
                  step.state === "current"
                    ? "text-foreground"
                    : step.state === "completed"
                      ? "text-foreground/80"
                      : step.state === "exception"
                        ? "text-warning"
                        : "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
              {step.occurredAt ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(step.occurredAt)}</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Estimate({ order }: { order: PublicOrder }) {
  const estimate = order.vm?.estimate
  if (!estimate) return null
  const start = estimate.startAt ? formatDate(estimate.startAt) : ""
  const end = estimate.endAt ? formatDate(estimate.endAt) : ""

  return (
    <div className="order-tracking__estimate flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-primary">
        <Icon name="truck" className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs font-semibold tracking-tight text-muted-foreground">{estimate.label}</p>
        <p className="mt-0.5 text-sm font-bold text-foreground">
          {start}{start && end ? " - " : ""}{end}
        </p>
      </div>
    </div>
  )
}

function ActionBanner({ order }: { order: PublicOrder }) {
  const action = order.vm?.actionRequired
  if (!action) return null

  return (
    <Alert
      tone={action.type === "contact_support" ? "danger" : action.type === "pay_now" ? "warning" : "info"}
      className="order-tracking__action-banner"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">{action.title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.message}</p>
        </div>
        {action.ctaLabel && action.ctaHref ? (
          <Button asChild size="sm">
            <a href={action.ctaHref}>{action.ctaLabel}</a>
          </Button>
        ) : null}
      </div>
    </Alert>
  )
}

function Recipient({ order }: { order: PublicOrder }) {
  const recipient = order.vm?.recipient
  if (!recipient) return null

  return (
    <section className="order-tracking__recipient">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon name="map-pin" className="size-4" aria-hidden="true" />
        <h3 className="text-xs font-bold tracking-tight">Informasi Pengiriman</h3>
      </div>
      <dl className="mt-3 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Penerima</dt>
          <dd className="text-right font-semibold text-foreground">{recipient.customerName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Nomor telepon</dt>
          <dd className="text-right tabular-nums text-foreground">{recipient.phoneMasked}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="shrink-0 text-muted-foreground">Alamat tujuan</dt>
          <dd className="text-right text-foreground">{recipient.address}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Metode pengiriman</dt>
          <dd className="text-right font-medium text-foreground">{recipient.method}</dd>
        </div>
      </dl>
    </section>
  )
}

function Carrier({ order, onCopyWaybill }: { order: PublicOrder; onCopyWaybill?: (waybill: string) => void }) {
  const carrier = order.vm?.carrier
  if (!carrier) return null

  return (
    <section className="order-tracking__carrier">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon name="package" className="size-4" aria-hidden="true" />
        <h3 className="text-xs font-bold tracking-tight">Pengiriman</h3>
      </div>
      <div className="mt-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-foreground">{carrier.carrierName}</p>
          <button
            type="button"
            onClick={() => onCopyWaybill?.(carrier.waybill)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Icon name="copy" className="size-3.5" aria-hidden="true" />
            Salin resi
          </button>
        </div>
        <p className="mt-1 font-mono text-sm tabular-nums text-foreground">{carrier.waybill}</p>
        {carrier.lastStatusAt ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Pembaruan terakhir diterima pada {formatDateTime(carrier.lastStatusAt)}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function ExpandableTimeline({ order }: { order: PublicOrder }) {
  const timeline = order.tracking?.timeline
  if (!timeline || timeline.length === 0) return null

  return (
    <details className="order-tracking__carrier-details group rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
        <span className="text-sm font-semibold text-foreground">Lihat detail perjalanan paket</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {timeline.length} pembaruan
          <Icon name="chevron-down" className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="border-t border-border">
        <ol className="order-tracking__carrier-details-list">
          {timeline.map((entry, index) => (
            <React.Fragment key={`${entry.at ?? "e"}-${index}`}>
              <li className="carrier-event flex gap-3 px-4 py-3">
                {entry.at ? (
                  <time dateTime={entry.at} className="w-28 shrink-0 text-xs leading-5 text-muted-foreground">
                    {formatDateTime(entry.at)}
                  </time>
                ) : (
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">-</span>
                )}
                <div className="min-w-0">
                  <p className="text-sm leading-5 text-foreground">{entry.message}</p>
                  {entry.location ? (
                    <p className="carrier-event__location mt-0.5 text-xs text-muted-foreground">{entry.location}</p>
                  ) : null}
                </div>
              </li>
              {index < timeline.length - 1 ? (
                <li aria-hidden="true" className="mx-4 h-px bg-border" />
              ) : null}
            </React.Fragment>
          ))}
        </ol>
      </div>
    </details>
  )
}

function PaymentSummary({ order }: { order: PublicOrder }) {
  const payment = order.vm?.payment
  if (!payment) return null
  const isCod = order.vm?.carrier?.paymentTerm === "COD" || order.payment_method === "cod"

  return (
    <section className="order-tracking__payment" id="pembayaran">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon name="badge-check" className="size-4" aria-hidden="true" />
        <h3 className="text-xs font-bold tracking-tight">Pembayaran</h3>
      </div>
      <dl className="mt-3 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Metode pembayaran</dt>
          <dd className="text-right font-semibold text-foreground">{payment.paymentMethod}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Status pembayaran</dt>
          <dd className="text-right font-medium text-foreground">{payment.statusLabel}</dd>
        </div>
        {payment.bank && payment.statusKey === "unpaid" ? (
          <div className="rounded-lg border border-border bg-surface-muted/40 p-3 space-y-2 text-sm">
            <p className="text-xs font-semibold text-muted-foreground">Instruksi Transfer</p>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Bank</dt>
              <dd className="text-right font-semibold text-foreground">{payment.bank.bank_name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">No. rekening</dt>
              <dd className="text-right tabular-nums font-semibold text-foreground">{payment.bank.account_number}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Atas nama</dt>
              <dd className="text-right font-semibold text-foreground">{payment.bank.account_name}</dd>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{payment.bank.notes}</p>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 border-t border-border pt-3">
          <dt className="text-muted-foreground">
            {isCod && payment.statusKey !== "paid" ? "Total yang dibayarkan saat menerima barang" : "Total pesanan"}
          </dt>
          <dd className="tabular-nums text-right text-lg font-bold text-foreground">
            {formatCurrency(order.total_amount)}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function SupportAction() {
  return (
    <section className="order-tracking__support rounded-lg border border-border bg-surface-muted/40 p-4" id="bantuan">
      <p className="text-sm font-bold text-foreground">Butuh bantuan dengan pesanan ini?</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Hubungi tim kami, sertakan nomor pesanan agar cepat ditindaklanjuti.
      </p>
      <Button asChild variant="secondary" className="mt-3">
        <Link href={routeUrl("contact")}>Hubungi Kami</Link>
      </Button>
    </section>
  )
}

export function OrderTrackingDetail({
  order,
  onCancel,
  cancelBusy = false,
}: {
  order: PublicOrder
  onCancel?: () => void
  cancelBusy?: boolean
}) {
  const [copied, setCopied] = React.useState(false)
  const handleCopy = (value: string) => {
    void navigator.clipboard?.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="order-tracking space-y-6">
      {/* Identity */}
      <div className="order-tracking__identity flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-tight text-success">Pesanan</p>
          <h2 className="tabular-nums mt-1 break-all font-mono text-xl font-semibold sm:text-2xl">
            {order.order_number}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Atas nama {order.customer_name}</p>
          {order.created_at ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Dibuat pada {formatDateTime(order.created_at)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => handleCopy(order.order_number)}
          className="inline-flex shrink-0 items-center gap-1.5 self-start text-xs font-medium text-primary hover:underline sm:self-end"
        >
          <Icon name="copy" className="size-3.5" aria-hidden="true" />
          {copied ? "Nomor disalin" : "Salin nomor pesanan"}
        </button>
      </div>

      {/* Action banner */}
      <ActionBanner order={order} />

      {/* Status hero */}
      <StatusHero order={order} />

      {/* Cancel CTA (hanya saat masih menunggu konfirmasi && user punya akses) */}
      {onCancel && order.order_status === "awaiting_confirmation" ? (
        <div className="order-tracking__cancel rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-bold text-destructive">Batalkan Pesanan</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Hanya bisa dibatalkan selama status masih menunggu konfirmasi.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={cancelBusy}
            onClick={onCancel}
          >
            {cancelBusy ? "Membatalkan..." : "Batalkan Pesanan"}
          </Button>
        </div>
      ) : null}

      {/* Milestone + current detail */}
      <div className="order-tracking__milestones rounded-lg border border-border bg-surface p-5">
        <p className="text-xs font-bold tracking-tight text-muted-foreground">Perkembangan pesanan</p>
        <div className="mt-4">
          <Milestones order={order} />
        </div>
      </div>

      {/* Estimate */}
      <Estimate order={order} />

      {/* Recipient */}
      <Recipient order={order} />

      {/* Carrier */}
      <Carrier order={order} onCopyWaybill={(w) => handleCopy(w)} />

      {/* Expandable timeline */}
      <ExpandableTimeline order={order} />

      {/* Payment */}
      <PaymentSummary order={order} />

      {/* Items */}
      <section className="order-tracking__items">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon name="package" className="size-4" aria-hidden="true" />
          <h3 className="text-xs font-bold tracking-tight">Item Pesanan</h3>
        </div>
        <ul className="mt-3 border-y border-border">
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
                    <span className="block font-semibold text-foreground">{item.product_name ?? item.name}</span>
                    {item.note ? (
                      <span className="mt-1 block max-w-full break-words rounded-md bg-accent/60 px-2 py-1 text-[11px] leading-4 text-accent-foreground">
                        <span className="font-semibold">Catatan:</span> {item.note}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block tabular-nums font-semibold text-foreground">
                      {item.line_total ? formatCurrency(item.line_total) : `${item.quantity} item`}
                    </span>
                    {unit ? (
                      <span className="mt-0.5 block tabular-nums text-xs text-muted-foreground">
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
      </section>

      {/* Review */}
      {order.reviews && order.reviews.length > 0 ? (
        <div className="order-tracking__reviews rounded-lg border border-border bg-surface-muted/40 p-4">
          <CustomerReviewForm
            orderNumber={order.order_number}
            customerPhone={order.customer_phone ?? ""}
            orderStatus={order.order_status}
            items={order.items}
            reviews={order.reviews}
          />
        </div>
      ) : null}

      {/* Support */}
      <SupportAction />
    </div>
  )
}