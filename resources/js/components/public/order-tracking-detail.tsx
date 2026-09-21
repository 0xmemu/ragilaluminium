import * as React from "react"
import { Link, usePage } from "@inertiajs/react"
import {
  Check,
  CheckCircle,
  Clock,
  Copy,
  CreditCard,
  Package,
  Truck,
} from "@phosphor-icons/react"

import { Icon } from "@/components/shared/icon"
import { TrustAssuranceCard } from "@/components/public/trust-assurance-card"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { StatusBadge } from "@/components/ui/status-badge"
import { CustomerReviewForm } from "@/components/public/customer-review-form"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { SharedPageProps } from "@/types"
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

/**
 * Card 1: Ringkasan Pesanan (OrderSummaryCard)
 * Sesuai desain sO2R6:
 * - No. Order + CopyButton independen di kiri atas
 * - Tanggal & waktu pembuatan (sampai jam:menit)
 * - Resi status + CopyButton independen
 * - Metode Pembayaran (COD / Transfer)
 * - Badge status sinkron dengan status pesanan di kanan atas
 * - Daftar item bisa dilipat di mobile, selalu terbuka di desktop
 */
function OrderSummaryCard({ order, className }: { order: PublicOrder; className?: string }) {
  const [expanded, setExpanded] = React.useState(true)
  const totalAmount = order.total_amount ? formatCurrency(order.total_amount) : "-"
  const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const isCod = order.payment_method === "cod"
  const paymentMethodLabel = isCod
    ? "COD (Bayar di tempat)"
    : (order.vm?.payment?.paymentMethod ?? "Transfer Bank")
  // Status pembayaran dipindah ke teks Metode Pembayaran (badge = Menunggu Konfirmasi).
  const paymentStateSuffix = isCod ? null : (order.vm?.payment?.statusLabel ?? null)

  return (
    <section
      className={cn(
        "order-tracking__summary-card rounded-[14px] border border-border bg-surface p-4 shadow-sm lg:p-5",
        className,
      )}
    >
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
            <span className="font-medium text-foreground">
              {paymentMethodLabel}
              {paymentStateSuffix ? ` (${paymentStateSuffix})` : ""}
            </span>
            {order.order_status === "cancelled" ? (
              <span className="mt-1.5 block text-[11px] font-semibold text-destructive">
                Pesanan ini telah dibatalkan. Hubungi kami bila perlu.
              </span>
            ) : null}
          </p>
        </div>

        <div className="shrink-0">
          <StatusBadge status={order.vm?.primaryStatus?.key ?? order.order_status} />
        </div>
      </div>

      {/* Divider */}
      <div className="mt-3.5 border-t border-border" />

      {/* Baris ringkasan Total X unit & Total Harga.
          Mobile: berfungsi sebagai dropdown. Desktop (lg): baris statis, selalu terbuka. */}
      <button
        type="button"
        className="flex w-full items-center justify-between py-2.5 text-left transition hover:opacity-80 lg:hidden"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls="order-tracking-items"
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
      <div className="hidden w-full items-center justify-between py-2.5 lg:flex">
        <span className="text-xs font-semibold text-foreground">
          Total {totalUnits} unit
        </span>
        <span className="tabular-nums text-sm sm:text-base font-bold text-foreground">
          {totalAmount}
        </span>
      </div>

      {/* Daftar Item Pesanan: terlipat di mobile, selalu terbuka di desktop */}
      <div id="order-tracking-items" className={cn(expanded ? "block" : "hidden", "lg:block")}>
        <ul className="divide-y divide-border border-t border-border pt-1">
          {order.items.map((item, index) => {
            const unitPrice = item.line_total ? Number(item.line_total) / item.quantity : null
            const title = item.product_name ?? item.name ?? "Produk"
            return (
              <li
                key={`item-${item.product_name ?? item.name}-${index}`}
                className="flex items-center gap-3 py-2.5"
              >
                <span className="relative flex size-12 flex-none items-center justify-center overflow-hidden rounded-[5px] border border-border bg-surface-muted lg:size-14">
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
                  {item.variant_label ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground lg:text-xs">
                      {item.variant_label?.replace(/ · /g, " / ")}
                    </p>
                  ) : null}
                  {item.note ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground lg:text-xs">
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
                      {item.quantity} × {formatCurrency(unitPrice)}
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
  
        {(() => {
          const b = order.billing
          if (!b) return null
          // Istilah disamakan dengan ringkasan checkout, dan asuransi TIDAK
          // lagi dipisah: pelanggan membayar satu ongkos kirim yang sudah
          // memuat asuransi (keputusan owner 2026-09-18). Pemisahan ongkir
          // dan asuransi tetap ada di kolom order dan halaman admin untuk
          // pembukuan, bukan untuk pelanggan.
          const insurancePaid = Number(b.insurance || 0)
          const shippingPaid = Number(b.shipping_net || 0) + insurancePaid
          // Harga ongkir SEBELUM subsidi (sudah termasuk asuransi), ditampilkan
          // tercoret di bawah angka yang dibayar: pola yang sama dengan
          // ringkasan checkout dan Subtotal Produk.
          const shippingOriginal = Number(b.shipping_gross || 0) + insurancePaid
          const shippingSubsidy = Math.abs(Number(b.shipping_subsidy || 0))
          const shippingSubsidyPercent =
            shippingSubsidy > 0 && Number(b.shipping_gross || 0) > 0
              ? Math.round((shippingSubsidy / Number(b.shipping_gross || 0)) * 100)
              : 0
          // `subtotal` sudah termasuk potongan, jadi harga aslinya ditampilkan
          // tercoret di bawahnya.
          const subtotalPaid = Number(b.subtotal || 0)
          const subtotalOriginal = subtotalPaid + Number(b.discount || 0)
          const hasCompareSubtotal = subtotalOriginal > subtotalPaid

          const moneyRow = (label: string, value: number, tone?: "sale") => (
            <div key={label} className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className={cn("tabular-nums font-semibold", tone === "sale" ? "text-sale" : "text-foreground")}>
                {formatCurrency(value)}
              </dd>
            </div>
          )

          return (
            <dl className="mt-1 space-y-1.5 border-t border-border pt-3 text-[11px] lg:text-xs">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Subtotal Produk</dt>
                <dd className="text-right">
                  <span className="tabular-nums block font-semibold text-foreground">
                    {formatCurrency(subtotalPaid)}
                  </span>
                  {hasCompareSubtotal ? (
                    <span className="tabular-nums block text-[11px] text-muted-foreground line-through">
                      {formatCurrency(subtotalOriginal)}
                    </span>
                  ) : null}
                </dd>
              </div>
              {Number(b.voucher_discount || 0) > 0
                ? moneyRow("Diskon Voucher", -Math.abs(Number(b.voucher_discount)), "sale")
                : null}

              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">
                  Ongkos Kirim{shippingSubsidyPercent > 0 ? ` (subsidi ${shippingSubsidyPercent}%)` : ""}
                </dt>
                <dd className="text-right">
                  <span className="tabular-nums block font-semibold text-foreground">
                    {formatCurrency(shippingPaid)}
                  </span>
                  {shippingOriginal > shippingPaid ? (
                    <span className="tabular-nums block text-[11px] text-muted-foreground line-through">
                      {formatCurrency(shippingOriginal)}
                    </span>
                  ) : null}
                </dd>
              </div>

              {Number(b.cod_fee || 0) > 0 ? moneyRow("Biaya COD", Number(b.cod_fee)) : null}

              <div className="flex items-center justify-between gap-4 border-t border-border pt-1.5">
                <dt className="font-bold text-foreground">Total Pembayaran</dt>
                <dd className="tabular-nums font-bold text-primary">{formatCurrency(b.total)}</dd>
              </div>
            </dl>
          )
        })()}
      </div>

      {/* Detail Pengiriman (revisi final 4: di dalam kartu ringkasan) */}
      <DetailPengiriman order={order} />
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
    <div className="order-tracking__detail-pengiriman mt-4 border-t border-border pt-3">
      <p className="text-xs font-bold tracking-tight text-muted-foreground">
        Detail Pengiriman
      </p>
      <div className="mt-2">
        <p className="text-sm font-semibold text-foreground">
          {recipient.customerName}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {recipient.phoneMasked}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {[recipient.city, recipient.province].filter(Boolean).join(", ")}
        </p>
      </div>
    </div>
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
const SUMMARY_ICONS: Record<string, typeof Clock> = {
  clock: Clock,
  "credit-card": CreditCard,
  package: Package,
  truck: Truck,
  "check-circle": CheckCircle,
}

function stepClass(state: string) {
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

/**
 * StatusSummary horizontal 4 makro STABIL (kontrak): Dikonfirmasi -> Disiapkan
 * -> Dikirim -> Selesai. Sumber TUNGGAL: order.vm.summary.steps (backend).
 * frontend hanya render; TIDAK menghitung status sendiri.
 */
function StatusSummary({ order }: { order: PublicOrder }) {
  const steps = order.vm?.summary?.steps ?? []
  if (steps.length === 0) return null

  return (
    <ol
      className="grid grid-cols-4 w-full"
      aria-label="Progres pesanan"
    >
      {steps.map((step, index) => {
        const Glyph = SUMMARY_ICONS[step.icon] ?? Package
        const active = step.state === "completed" || step.state === "current"
        const isLast = index === steps.length - 1
        // Connector line presisi antar titik tengah icon (identik di semua step)
        const connectorColor =
          step.state === "completed" ? "bg-[#2b734e]" : "bg-border/60"
        return (
          <li
            key={step.key}
            aria-current={step.state === "current" ? "step" : undefined}
            className="relative flex flex-col items-center text-center min-w-0"
          >
            {/* Garis penghubung antar ikon. Sengaja TIDAK dimulai dari titik
                tengah: ikon langkah aktif berlatar semi transparan (tint 10%),
                sehingga garis yang lewat di belakangnya tampak menembus
                lingkarannya. Garis kini mulai dan berakhir tepat di tepi ikon
                (setengah dari size-11 = 22px), jadi tidak pernah berada di
                belakang ikon. Bila ukuran ikon diubah, angka 22px ini harus
                ikut disesuaikan. */}
            {!isLast ? (
              <div
                aria-hidden="true"
                className={cn(
                  "absolute left-[calc(50%_+_22px)] right-[calc(-50%_+_22px)] top-[22px] h-[2px] -translate-y-1/2 z-0",
                  connectorColor,
                )}
              />
            ) : null}

            {/* Lingkaran Icon */}
            <span
              className={cn(
                "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full transition-colors",
                stepClass(step.state),
              )}
            >
              {step.state === "completed" ? (
                <Check className="size-5" weight="bold" />
              ) : (
                <Glyph
                  className="size-5"
                  weight={step.state === "current" ? "bold" : "regular"}
                />
              )}
            </span>

            {/* Label Status */}
            <span
              className={cn(
                "mt-1.5 px-0.5 text-[11px] leading-tight text-center break-words w-full",
                active ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Lacak Pesanan (kontrak 6): KARTU CURRENT STATUS, bukan history panjang.
 * Menampilkan status pelanggan terkini + timestamp menit + ringkasan posisi +
 * sumber event (toko / J&T Cargo). Raw event tidak dirender di website.
 */
/**
 * Lacak Pesanan = VERTICAL TIMELINE (revisi final 9-13): seluruh event penting
 * yang SUDAH TERJADI, diterjemahkan label customer-facing. Item terakhir
 * (keadaan terkini) berisi label + tanggal jam menit + ringkasan posisi +
 * sumber update. Raw event J&T TIDAK pernah dirender.
 */
function LacakPesanan({ order }: { order: PublicOrder }) {
  const events = order.vm?.events ?? []
  if (events.length === 0) return null

  const lastIndex = events.length - 1

  return (
    <ol className="order-tracking__timeline space-y-0">
      {events.map((ev, index) => {
        const isLatest = index === lastIndex
        const isStore = ev.source === "store"
        return (
          <li key={`${ev.key}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">
            {index < lastIndex ? (
              <span
                aria-hidden="true"
                className="absolute left-[13px] top-8 h-[calc(100%-2.25rem)] w-0.5 bg-border"
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full",
                isLatest
                  ? "border-2 border-[#2b734e] bg-[#2b734e]/10 text-[#2b734e]"
                  : "bg-[#2b734e] text-white",
              )}
            >
              <Icon
                name={isStore ? "package" : "truck"}
                className="size-3.5"
                weight="bold"
              />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn("text-sm font-semibold", isLatest ? "text-foreground" : "text-foreground/85")}>
                {ev.label}
              </p>
              {ev.at ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateTime(ev.at)} WIB
                </p>
              ) : null}
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{ev.position}</p>
              {(ev.detail?.destination || ev.detail?.location) ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {ev.detail?.origin && ev.detail?.destination
                    ? `Dari ${ev.detail.origin} menuju ${ev.detail.destination}.`
                    : ev.detail?.destination
                      ? `Menuju ${ev.detail.destination}.`
                      : `Lokasi terakhir: ${ev.detail?.location}.`}
                </p>
              ) : null}
              {ev.detail?.courierName ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Kurir: {ev.detail.courierName}
                  {ev.detail.courierPhone ? ` · ${ev.detail.courierPhone}` : ""}
                </p>
              ) : null}
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground/80">
                {isStore ? "Diperbarui oleh toko" : "Pembaruan J&T Cargo"}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Card 3: J&T Cargo + Stepper + Lacak Pesanan
 */
function JnTCard({ order, className }: { order: PublicOrder; className?: string }) {
  const carrier = order.vm?.carrier
  const shipment = order.vm?.shipment

  return (
    <section
      id="lacak-pengiriman"
      className={cn(
        "order-tracking__jnt-card space-y-5 rounded-[14px] border border-border bg-surface p-5 shadow-sm scroll-mt-20 lg:p-6",
        className,
      )}
    >
      {/* Brand Header J&T Cargo Icon */}
      <div className="space-y-1">
        <JntCargoLogo />
        <div className="pt-1">
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
          {shipment?.officialTrackingUrl ? (
            <a
              href={shipment.officialTrackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#2b734e] underline-offset-2 hover:underline"
            >
              Lacak di J&T Cargo
              <Icon name="arrow-up-right" className="size-3" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>

      {/* Stepper Status Horizontal (4 Makro: Dikonfirmasi/Disiapkan/Dikirim/Selesai) */}
      <div className="pt-2">
        <StatusSummary order={order} />
      </div>

      {/* Lacak Pesanan: current status card (kontrak 6) */}
      <div className="pt-2 border-t border-border">
        <p className="text-xs font-bold tracking-tight text-foreground mb-3">
          Lacak Pesanan
        </p>
        <LacakPesanan order={order} />
      </div>
    </section>
  )
}

/**
 * Card 4: Support Section
 */
function SupportAction({ className }: { className?: string }) {
  // Teks diatur admin lewat Pengaturan Website > CTA Storefront, blok
  // "Bantuan di halaman Pesanan". Fallback = teks bawaan CtaSettings.
  const { ctaSettings } = usePage<SharedPageProps>().props
  const configured = ctaSettings?.pages?.["order-help"]
  const title = configured?.eyebrow || "Butuh bantuan dengan pesanan ini?"
  const body = configured?.heading || "Hubungi tim kami, sertakan nomor pesanan agar cepat ditindaklanjuti."

  return (
    <section
      className={cn(
        "order-tracking__support rounded-[14px] border border-border bg-surface-muted/40 p-4 shadow-sm lg:p-5",
        className,
      )}
      id="bantuan"
    >
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
      <Button asChild variant="secondary" size="sm" className="mt-3 rounded-full border border-border bg-surface hover:bg-surface-muted text-foreground font-semibold text-xs px-4 py-2">
        <Link href={routeUrl("contact")}>Hubungi Kami</Link>
      </Button>
    </section>
  )
}

/**
 * Card 5: Trust Assurance
 */
/**
 * Alur pengembalian barang untuk pelanggan.
 *
 * Sumber TUNGGAL: order.vm.returnFlow (backend). Komponen ini tidak menghitung
 * status sendiri. Muncul hanya saat pesanan sudah masuk status retur.
 */
function ReturnFlowCard({ order }: { order: PublicOrder }) {
  const flow = order.vm?.returnFlow
  if (!flow) return null

  return (
    <section className="order-tracking__return-flow rounded-[14px] border border-border bg-surface p-4 shadow-sm lg:p-5">
      <p className="text-sm font-bold text-foreground">{flow.title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{flow.description}</p>

      <ol className="mt-4">
        {flow.steps.map((step, index) => {
          const Glyph = SUMMARY_ICONS[step.icon] ?? Package
          const active = step.state === "completed" || step.state === "current"
          const isLast = index === flow.steps.length - 1
          return (
            <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
              {/* Garis penghubung antar lingkaran, berhenti di tepi ikon supaya
                  tidak menembus lingkarannya. */}
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-[21px] top-11 bottom-0 w-[2px]",
                    step.state === "completed" ? "bg-[#2b734e]" : "bg-border/60",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full",
                  stepClass(step.state),
                )}
              >
                {step.state === "completed" ? (
                  <Check className="size-5" weight="bold" />
                ) : (
                  <Glyph
                    className="size-5"
                    weight={step.state === "current" ? "bold" : "regular"}
                  />
                )}
              </span>
              <span
                className={cn(
                  "pt-3 text-xs leading-tight",
                  active ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/**
 * Kartu tindakan khusus pesanan yang sudah Sampai: ajakan mengulas plus jalur
 * bantuan WhatsApp. Dipisah dari kartu bantuan umum supaya pelanggan yang
 * pesanannya sudah tiba melihat tindakan yang relevan lebih dulu.
 */
function DeliveredActions({ order }: { order: PublicOrder }) {
  if (order.order_status !== "delivered") return null

  return (
    <CustomerReviewForm
      orderNumber={order.order_number}
      orderStatus={order.order_status}
      items={order.items}
      reviews={order.reviews}
      variant="banner"
      chatUrl={order.whatsapp_url ?? null}
    />
  )
}

/**
 * Tombol pengajuan pengembalian barang.
 *
 * Skema retur full manual (keputusan owner 2026-09-21): pengajuan dilakukan
 * lewat WhatsApp supaya dibicarakan dulu dengan admin. Karena itu tombol ini
 * hanya membuka percakapan dan TIDAK mengubah status pesanan; status baru
 * berpindah saat admin mencatat kasus returnya.
 *
 * Gaya merah sengaja redup (garis tepi, bukan blok merah penuh): ini tindakan
 * yang jarang dipakai dan tidak boleh mencolok dibanding tombol ulasan.
 */
function ReturnRequestButton({ order }: { order: PublicOrder }) {
  if (order.order_status !== "delivered") return null

  const href = order.return_whatsapp_url
  if (!href) return null

  return (
    <div>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-xs font-semibold text-destructive transition hover:border-destructive/70 hover:bg-destructive/10 sm:w-auto"
      >
        <Icon name="arrow-counter-clockwise" className="size-4" aria-hidden="true" />
        Pengembalian Barang
      </a>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
        Ajukan lewat WhatsApp dulu supaya bisa dibicarakan dengan admin sebelum diproses.
      </p>
    </div>
  )
}

/**
 * Komponen Utama OrderTrackingDetail
 */

export function OrderTrackingDetail({ order }: { order: PublicOrder }) {
  return (
    <div className="order-tracking mx-auto grid max-w-lg gap-4 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
      {/* Urutan DOM = urutan MOBILE (tidak diubah). Di desktop kolom diatur
          lewat col-start/row-start: kartu lacak pindah ke kolom kanan,
          sementara bantuan & jaminan tetap di kolom kiri bawah kartu penerima. */}

      {/* Pesanan Sampai: sapaan "sudah sampai" + tombol Beri Ulasan dan Chat WhatsApp */}
      <DeliveredActions order={order} />

      {/* Alur pengembalian barang, hanya saat status pesanan sudah retur */}
      <ReturnFlowCard order={order} />

      {/* 1. Ringkasan Pesanan (status pembatalan & Detail Pengiriman di dalam) */}
      <OrderSummaryCard order={order} className="lg:col-start-1" />

      {/* 2. J&T Cargo + Stepper 4-Step + Lacak Pesanan */}
      <JnTCard order={order} className="lg:col-start-2 lg:row-start-1" />

      {/* 3. Bantuan & jaminan: tepat di bawah kartu penerima (kolom kiri).
          Untuk pesanan Sampai, ajakan mengulas dan chat WhatsApp sudah ada di
          kartu atas, jadi kartu bantuan umum tidak perlu diulang. */}
      {order.order_status !== "delivered" ? <SupportAction className="lg:col-start-1" /> : null}

      {/* Tombol pengembalian barang: tepat di bawah kartu Sampai, sengaja
          dipisah karena tindakan ini jarang dipakai dan perlu penjelasan. */}
      <div className="lg:col-start-1">
        <ReturnRequestButton order={order} />
      </div>

      <TrustAssuranceCard className="px-4 lg:col-start-1 lg:px-5" />

    </div>
  )
}
