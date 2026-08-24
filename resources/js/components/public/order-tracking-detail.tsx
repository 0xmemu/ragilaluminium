import * as React from "react"
import { Link } from "@inertiajs/react"
import {
  Check,
  CheckCircle,
  Clock,
  Copy,
  Package,
  ShieldCheck,
  Truck,
  Warning,
} from "@phosphor-icons/react"

import { Icon } from "@/components/shared/icon"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { StatusBadge } from "@/components/ui/status-badge"
import { CustomerReviewForm } from "@/components/public/customer-review-form"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { PublicOrder } from "@/types"

/**
 * Reusable CopyButton dengan state independen per tombol.
 * Mencegah anomali klik satu tombol memicu centang di tombol lain.
 */
function CopyButton({
  text,
  label = "Salin",
  className,
  iconSize = "size-3.5",
}: {
  text: string
  label?: string
  className?: string
  iconSize?: string
}) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    void navigator.clipboard?.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded",
        className,
      )}
      aria-label={label}
      title={copied ? "Tersalin!" : label}
    >
      {copied ? (
        <Check className={cn(iconSize, "text-success")} weight="bold" />
      ) : (
        <Copy className={iconSize} />
      )}
    </button>
  )
}

/**
 * J&T Cargo Logo Icon menggunakan asset resmi /images/jnt-cargo.png.
 */
function JntCargoLogo({ className }: { className?: string }) {
  return (
    <img
      src="/images/jnt-cargo.png"
      alt="J&T CARGO"
      className={cn("h-7 w-auto object-contain", className)}
      loading="eager"
    />
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
        {action.type === "contact_support" && order.whatsapp_url ? (
          <Button asChild size="sm" variant="secondary">
            <a href={order.whatsapp_url} target="_blank" rel="noreferrer">
              Buka WhatsApp
            </a>
          </Button>
        ) : null}
      </div>
    </Alert>
  )
}

/**
 * Card 1: Ringkasan Pesanan (OrderSummaryCard)
 * Sesuai desain sO2R6:
 * - No. Order + CopyButton independen di kiri atas
 * - Tanggal & waktu pembuatan (sampai jam:menit)
 * - Resi status + CopyButton independen
 * - Metode Pembayaran (COD / Transfer)
 * - Badge status sinkron dengan status pesanan di kanan atas
 * - Collapsible items list dengan format Total X unit & total harga
 */
function OrderSummaryCard({ order }: { order: PublicOrder }) {
  const [expanded, setExpanded] = React.useState(true)
  const totalAmount = order.total_amount ? formatCurrency(order.total_amount) : "-"
  const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const isCod = order.payment_method === "cod"
  const paymentMethodLabel = isCod
    ? "COD (Bayar di tempat)"
    : (order.vm?.payment?.paymentMethod ?? "Transfer Bank")

  return (
    <section className="order-tracking__summary-card rounded-[14px] border border-border bg-surface p-4 shadow-sm">
      {/* Header Baris 1: No. Order + Copy di kiri, Status Badge di kanan */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold text-primary">
              No. Order {order.order_number}
            </span>
            <CopyButton
              text={order.order_number}
              label="Salin nomor pesanan"
              className="size-5"
              iconSize="size-3.5"
            />
          </div>
          {order.created_at ? (
            <p className="text-[11px] text-muted-foreground">
              {formatDateTime(order.created_at)}
            </p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            No. Resi{" "}
            {order.vm?.carrier?.waybill ? (
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                {order.vm.carrier.waybill}
                <CopyButton
                  text={order.vm.carrier.waybill}
                  label="Salin nomor resi"
                  className="size-4"
                  iconSize="size-3"
                />
              </span>
            ) : (
              <span className="font-medium text-muted-foreground">Belum tersedia</span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Metode Pembayaran:{" "}
            <span className="font-medium text-foreground">{paymentMethodLabel}</span>
          </p>
        </div>

        <div className="shrink-0">
          <StatusBadge status={order.order_status} />
        </div>
      </div>

      {/* Divider */}
      <div className="mt-3.5 border-t border-border" />

      {/* Collapsible Trigger: Total X unit & Total Harga */}
      <button
        type="button"
        className="flex w-full items-center justify-between py-2.5 text-left transition hover:opacity-80"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1 text-xs font-semibold text-foreground">
          Total {totalUnits} unit
          <Icon
            name={expanded ? "chevron-up" : "chevron-down"}
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
        </span>
        <span className="tabular-nums text-sm sm:text-base font-bold text-foreground">
          {totalAmount}
        </span>
      </button>

      {/* Daftar Item Pesanan */}
      {expanded ? (
        <ul className="divide-y divide-border border-t border-border pt-1">
          {order.items.map((item, index) => {
            const unitPrice = item.line_total ? Number(item.line_total) / item.quantity : null
            const title = item.product_name ?? item.name ?? "Produk"
            return (
              <li
                key={`item-${item.product_name ?? item.name}-${index}`}
                className="flex items-center gap-3 py-2.5"
              >
                <span className="relative flex size-12 flex-none items-center justify-center overflow-hidden rounded-[5px] border border-border bg-surface-muted">
                  <ResponsiveImage
                    src={item.image ?? null}
                    alt={title}
                    wrapperClassName="size-full"
                    className="size-full object-cover"
                  />
                </span>

                <div className="min-w-0 flex-1">
                  {item.parent_sku ? (
                    <Link
                      href={routeUrl("product.show", { parent_sku: item.parent_sku })}
                      className="block text-xs font-semibold text-foreground hover:text-primary leading-snug"
                    >
                      {title}
                    </Link>
                  ) : (
                    <span className="block text-xs font-semibold text-foreground leading-snug">
                      {title}
                    </span>
                  )}
                  {item.note ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Catatan: {item.note}
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0 text-right">
                  <p className="block tabular-nums text-xs font-semibold text-foreground">
                    {item.line_total ? formatCurrency(item.line_total) : `${item.quantity} item`}
                  </p>
                  {unitPrice ? (
                    <p className="mt-0.5 block tabular-nums text-[11px] text-muted-foreground">
                      {item.quantity} � {formatCurrency(unitPrice)}
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

/**
 * Card 2: Detail Pengiriman (DetailPengiriman)
 * Format bersih:
 * - Header "Detail Pengiriman"
 * - Nama Penerima + Nomor Telepon
 * - Alamat lengkap yang mengalir
 */
function DetailPengiriman({ order }: { order: PublicOrder }) {
  const recipient = order.vm?.recipient
  if (!recipient) return null

  return (
    <section className="order-tracking__detail-pengiriman rounded-[14px] border border-border bg-surface p-4 shadow-sm">
      <h3 className="text-xs font-bold tracking-tight text-muted-foreground">
        Detail Pengiriman
      </h3>
      <div className="mt-2.5">
        <p className="text-sm font-semibold text-foreground">
          {recipient.customerName} {recipient.phoneMasked}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {recipient.address}
        </p>
      </div>
    </section>
  )
}

/**
 * Stepper 4 Tahap Horizontal di dalam Card J&T Cargo.
 * Tahap utama disesuaikan:
 * 1. Terkonfirmasi (Clock)
 * 2. Pesanan Dikirim (Package / Box)
 * 3. Pesanan Sampai COD (Lunas) (Truck)
 * 4. Selesai (CheckCircle)
 */
const PROGRESS_ICONS: Record<string, typeof Clock> = {
  confirmed: Clock,
  prepared: Package,
  handover: Truck,
  transit: Truck,
  last_mile: Truck,
  delivered: CheckCircle,
  completed: CheckCircle,
}

/**
 * Tracker ringkas (kontrak sinkronisasi): SUMBER TUNGGAL order.vm.progress.
 * "Pesanan dikirim" HANYA muncul saat event carrier membuktikannya (state
 * handover complete/current) - tidak pernah dari order_status internal.
 */
function StatusSummary({ order }: { order: PublicOrder }) {
  const progress = order.vm?.progress ?? []
  if (progress.length === 0) return null

  const stepClass = (state: string) => {
    switch (state) {
      case "completed":
        return "bg-[#2b734e] text-white shadow-sm ring-4 ring-[#2b734e]/15"
      case "current":
        return "border-2 border-[#2b734e] bg-[#2b734e]/10 text-[#2b734e] ring-4 ring-[#2b734e]/10"
      case "attention":
      case "exception":
        return "border-2 border-warning bg-warning/10 text-warning ring-4 ring-warning/10"
      default:
        return "border-2 border-border bg-surface text-muted-foreground"
    }
  }

  return (
    <div className="relative">
      {/* Background connector line */}
      <div
        aria-hidden="true"
        className="absolute top-6 left-[2.5%] right-[2.5%] h-0.5 bg-border -translate-y-1/2 z-0"
      />
      <ol className="relative z-10 grid grid-cols-7 gap-1 text-center">
        {progress.map((step) => {
          const Glyph = PROGRESS_ICONS[step.key] ?? Package
          const active = step.state === "completed" || step.state === "current"
          return (
            <li key={step.key} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full transition-colors",
                  stepClass(step.state),
                )}
              >
                <Glyph
                  className="size-5"
                  weight={step.state === "completed" ? "bold" : step.state === "current" ? "bold" : "regular"}
                />
              </span>
              <span
                className={cn(
                  "text-[10px] leading-tight max-w-full",
                  active ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/**
 * Vertical Timeline ("Lacak Pesanan") di dalam Card J&T.
 * Timestamp detail memuat tanggal dan jam:menit.
 * Berwarna hijau #2b734e untuk milestone yang selesai.
 */
function Milestones({ order }: { order: PublicOrder }) {
  const milestones = order.vm?.milestones
  if (!milestones || milestones.length === 0) return null

  return (
    <ol className="order-tracking__milestones space-y-0">
      {milestones.map((step, index) => {
        const isLast = index === milestones.length - 1
        const isDone = step.state === "completed"
        const isCurrent = step.state === "current"
        const isException = step.state === "exception"

        const connector = !isLast ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-0.5",
              isDone || isCurrent ? "bg-[#2b734e]/40" : "bg-border",
            )}
          />
        ) : null

        return (
          <li key={step.key + index} className="relative flex gap-3 pb-5 last:pb-0">
            {connector}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full",
                isDone && "bg-[#2b734e] text-white",
                isCurrent && "bg-[#2b734e] text-white ring-4 ring-[#2b734e]/20",
                isException && "bg-destructive text-white",
                !isDone && !isCurrent && !isException && "border-2 border-border bg-surface text-muted-foreground",
              )}
            >
              {isDone ? (
                <Check className="size-3.5" weight="bold" />
              ) : isException ? (
                <Warning className="size-3.5" weight="bold" />
              ) : isCurrent ? (
                <Check className="size-3.5" weight="bold" />
              ) : (
                <span className="size-1.5 rounded-full bg-border" />
              )}
            </span>

            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  "text-sm font-semibold",
                  isCurrent || isDone ? "text-foreground" : "text-muted-foreground",
                  isException && "text-destructive",
                )}
              >
                {step.label}
              </p>
              {step.occurredAt ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateTime(step.occurredAt)}
                </p>
              ) : null}
              {step.customerMessage ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {step.customerMessage}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Expandable J&T Webhook Scan Events (bila tersedia) dengan timestamp jam:menit.
 */
function ExpandableTimeline({ order }: { order: PublicOrder }) {
  const timeline = (order.tracking_public ?? order.tracking)?.timeline
  if (!timeline || timeline.length === 0) return null

  return (
    <details className="order-tracking__carrier-details group mt-4 rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3.5">
        <span className="text-xs font-semibold text-foreground">
          Lihat detail perjalanan paket
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {timeline.length} pembaruan
          <Icon
            name="chevron-down"
            className="size-3.5 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="border-t border-border">
        <ol className="order-tracking__carrier-details-list divide-y divide-border">
          {timeline.map((entry, index) => (
            <li key={`${entry.at ?? "e"}-${index}`} className="flex gap-3 px-3.5 py-2.5">
              {entry.at ? (
                <time
                  dateTime={entry.at}
                  className="w-28 shrink-0 text-[11px] leading-relaxed text-muted-foreground"
                >
                  {formatDateTime(entry.at)}
                </time>
              ) : (
                <span className="w-28 shrink-0 text-[11px] text-muted-foreground">-</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-relaxed text-foreground">{entry.message}</p>
                {entry.location ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {entry.location}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </details>
  )
}

/**
 * Card 3: J&T Cargo + Stepper + Lacak Pesanan
 */
function JnTCard({ order }: { order: PublicOrder }) {
  const carrier = order.vm?.carrier
  const hasTimeline =
    (order.tracking_public ?? order.tracking)?.timeline &&
    (order.tracking_public ?? order.tracking)!.timeline!.length > 0

  return (
    <section className="order-tracking__jnt-card rounded-[14px] border border-border bg-surface p-5 shadow-sm space-y-5">
      {/* Brand Header J&T Cargo Icon */}
      <div className="space-y-3">
        <JntCargoLogo />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">No. Pesanan</p>
          <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-foreground">
            <span>{order.order_number}</span>
            <CopyButton
              text={order.order_number}
              label="Salin nomor pesanan"
              className="size-5"
              iconSize="size-3.5"
            />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">No. Resi</p>
          {carrier?.waybill ? (
            <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-foreground">
              <span>{carrier.waybill}</span>
              <CopyButton
                text={carrier.waybill}
                label="Salin nomor resi"
                className="size-5"
                iconSize="size-3.5"
              />
            </div>
          ) : (
            <p className="font-mono text-sm font-semibold text-muted-foreground">Belum tersedia</p>
          )}
        </div>
      </div>

      {/* Stepper Status Horizontal (4-Step Hijau) */}
      <div className="pt-2">
        <StatusSummary order={order} />
      </div>

      {/* Timeline Vertikal (Lacak Pesanan) */}
      <div className="pt-2 border-t border-border">
        <h3 className="text-xs font-bold tracking-tight text-foreground mb-4">
          Lacak Pesanan
        </h3>
        <Milestones order={order} />
        {hasTimeline ? <ExpandableTimeline order={order} /> : null}
      </div>
    </section>
  )
}

/**
 * Card 4: Support Section
 */
function SupportAction() {
  return (
    <section
      className="order-tracking__support rounded-[14px] border border-border bg-surface-muted/40 p-4 shadow-sm"
      id="bantuan"
    >
      <p className="text-sm font-bold text-foreground">Butuh bantuan dengan pesanan ini?</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Hubungi tim kami, sertakan nomor pesanan agar cepat ditindaklanjuti.
      </p>
      <Button asChild variant="secondary" size="sm" className="mt-3 rounded-full border border-border bg-surface hover:bg-surface-muted text-foreground font-semibold text-xs px-4 py-2">
        <Link href={routeUrl("contact")}>Hubungi Kami</Link>
      </Button>
    </section>
  )
}

/**
 * Card 5: Trust Assurance
 */
function TrustAssurance() {
  return (
    <section className="order-tracking__trust rounded-[14px] border border-border bg-surface-muted p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <ShieldCheck className="size-6 shrink-0 text-foreground" weight="regular" />
        <div>
          <p className="text-xs font-bold text-foreground">Belanja Aman & Terpercaya</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Garansi jika produk rusak, pengiriman aman, dan pelayanan terbaik.
          </p>
        </div>
      </div>
    </section>
  )
}

/**
 * Phase E: StatusNotice — render status dictionary ViewModel (headline +
 * message + tone) supaya hierarchy jelas dan a11y-friendly (role=status).
 */
const STATUS_TONE_CLASSES: Record<string, string> = {
  success: "border-[#2b734e33] bg-[#2b734e0d] text-[#2b734e]",
  danger: "border-[#bd111133] bg-[#bd11110d] text-[#bd1111]",
  warning: "border-[#8d570c33] bg-[#8d570c0d] text-[#8d570c]",
  neutral: "border-border bg-surface-muted text-foreground",
  info: "border-[#2c6d9b33] bg-[#2c6d9b0d] text-[#2c6d9b]",
}

function StatusNotice({ order }: { order: PublicOrder }) {
  const primary = order.vm?.primaryStatus
  if (!primary || !primary.headline) return null
  const tone = STATUS_TONE_CLASSES[primary.tone] ?? STATUS_TONE_CLASSES.neutral

  return (
    <section
      role="status"
      className={`order-tracking__status-notice rounded-[14px] border p-4 shadow-sm ${tone}`}
    >
      <p className="text-sm font-bold text-foreground">{primary.headline}</p>
      {primary.message ? (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{primary.message}</p>
      ) : null}
    </section>
  )
}

/**
 * Card: Retur & Penyelesaian (Phase D) — hanya utk pesanan delivered.
 * Eligibility dari ReturnService (delivered + paid + <=48 jam); CTA WhatsApp
 * dgn order reference. Completed tidak menampilkan kartu ini (copy A2).
 */
function ReturnBlockCard({ order }: { order: PublicOrder }) {
  if (order.order_status !== "delivered") return null
  const block = order.return_block
  if (!block) return null

  const deadlineText = block.deadline
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(block.deadline))
    : null
  const deliveredText = order.delivered_at
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.delivered_at))
    : null

  return (
    <section className="order-tracking__return rounded-[14px] border border-border bg-surface p-4 shadow-sm">
      <h3 className="text-xs font-bold tracking-tight text-muted-foreground">Retur &amp; Penyelesaian</h3>
      {deliveredText ? (
        <p className="mt-2 text-xs text-muted-foreground">Paket sampai: {deliveredText} WIB</p>
      ) : null}
      {block.eligible ? (
        <div className="mt-2">
          <p className="text-sm font-semibold text-foreground">Anda dapat mengajukan retur</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {block.deadline && deadlineText
              ? `Ajukan sebelum ${deadlineText} WIB sesuai kebijakan 48 jam setelah barang sampai.`
              : "Ajukan sesuai kebijakan 48 jam setelah barang sampai."}
          </p>
          {order.return_whatsapp_url ? (
            <Button asChild size="sm" className="mt-3">
              <a href={order.return_whatsapp_url} target="_blank" rel="noreferrer">
                Ajukan Retur via WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-sm font-medium text-foreground">{block.reason ?? "Retur tidak dapat diajukan."}</p>
          {order.return_whatsapp_url ? (
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <a href={order.return_whatsapp_url} target="_blank" rel="noreferrer">
                Tindak Lanjut via WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
      )}
    </section>
  )
}

/**
 * Komponen Utama OrderTrackingDetail
 */
/**
 * Kartu "Posisi paket saat ini" (kontrak B). Sumber: order.vm.position +
 * order.vm.shipment. Timestamp event carrier = "Pembaruan pengiriman";
 * timestamp sistem = "Data disinkronkan". Tidak mengarang lokasi.
 */
function PositionCard({ order, onRefresh }: { order: PublicOrder; onRefresh?: () => void }) {
  const position = order.vm?.position
  if (!position) return null

  return (
    <section className="order-tracking__position rounded-[14px] border border-border bg-surface p-4 shadow-sm">
      <h3 className="text-xs font-bold tracking-tight text-foreground">Posisi paket saat ini</h3>
      <p className="mt-2 text-sm font-semibold text-foreground">{position.text}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{position.description}</p>
      <div className="mt-3 space-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
        {position.latestEventAt ? (
          <p>Pembaruan pengiriman: {formatDateTime(position.latestEventAt)}</p>
        ) : null}
        {position.syncedAt ? (
          <p>Data disinkronkan: {formatDateTime(position.syncedAt)}</p>
        ) : null}
      </div>
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          className="mt-3 text-xs font-semibold text-[#2b734e] underline-offset-2 hover:underline"
        >
          Muat Ulang
        </button>
      ) : null}
    </section>
  )
}

export function OrderTrackingDetail({
  order,
  onCancel,
  cancelBusy = false,
  onRefresh,
}: {
  order: PublicOrder
  onCancel?: () => void
  cancelBusy?: boolean
  onRefresh?: () => void
}) {
  return (
    <div className="order-tracking space-y-4 max-w-lg mx-auto">
      {/* 0. Status utama (kontrak A2: headline + message + tone) */}
      <StatusNotice order={order} />

      {/* 0b. Posisi paket saat ini (kontrak B) */}
      <PositionCard order={order} onRefresh={onRefresh} />

      {/* 1. Ringkasan Pesanan */}
      <OrderSummaryCard order={order} />

      {/* 2. Action banner & Cancel (bila status awaiting_confirmation) */}
      <ActionBanner order={order} />
      {onCancel && order.order_status === "awaiting_confirmation" ? (
        <div className="order-tracking__cancel rounded-[14px] border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-bold text-destructive">Batalkan Pesanan</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Hanya bisa dibatalkan selama status masih menunggu konfirmasi.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/10 rounded-full"
            disabled={cancelBusy}
            onClick={onCancel}
          >
            {cancelBusy ? "Membatalkan..." : "Batalkan Pesanan"}
          </Button>
        </div>
      ) : null}

      {/* 3. Detail Pengiriman */}
      <DetailPengiriman order={order} />

      {/* 4. J&T Cargo + Stepper 4-Step + Lacak Pesanan */}
      <JnTCard order={order} />

      {/* 4b. Retur & Penyelesaian (delivered only) */}
      <ReturnBlockCard order={order} />

      {/* 5. Support Section */}
      <SupportAction />

      {/* 6. Trust Assurance */}
      <TrustAssurance />

      {/* 7. Review Form jika status delivered / completed */}
      {order.order_status === "delivered" || order.order_status === "completed" ? (
        <CustomerReviewForm
          orderNumber={order.order_number}
          customerPhone={order.customer_phone ?? ""}
          orderStatus={order.order_status}
          items={order.items}
          reviews={order.reviews}
        />
      ) : null}
    </div>
  )
}
