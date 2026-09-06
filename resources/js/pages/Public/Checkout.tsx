import { Head, Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { CheckoutAddressForm } from "@/components/public/checkout-address-form"
import { CheckoutItemNotes } from "@/components/public/checkout-item-notes"
import { CheckoutPaymentSection } from "@/components/public/checkout-payment-section"
import { CheckoutSummary, type CheckoutItem } from "@/components/public/checkout-summary"
import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { EmptyState } from "@/components/ui/empty-state"
import { useCheckout, type CheckoutCodConfig } from "@/hooks/use-checkout"
import PublicLayout from "@/layouts/public-layout"
import { formatCurrency } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { CheckoutDetails, OrderEta, SharedPageProps } from "@/types"

export interface CheckoutShipping {
  gross: number
  subsidy: number
  net: number
  applied: boolean
}

interface CheckoutProps {
  items: CheckoutItem[]
  subtotal: number
  compare_subtotal?: number
  discount_total?: number
  voucher?: {
    code: string
    name: string
    discount: number
    vouchers?: Array<{ code: string; name: string; discount: number; stackable?: boolean }>
  } | null
  voucher_discount?: number
  cod?: CheckoutCodConfig
  shipping?: CheckoutShipping | null
  eta?: OrderEta | null
  defaultPayment?: string | null
  details?: CheckoutDetails | null
  applyVoucherUrl: string
  removeVoucherUrl: string
  shippingQuoteUrl?: string | null
  shippingWeightKg?: number
  insurance?: boolean
}

export default function Checkout({
  items = [],
  subtotal = 0,
  compare_subtotal: _compareSubtotal = 0,
  discount_total = 0,
  voucher = null,
  voucher_discount = 0,
  cod = {
    enabled: true,
    allowed: true,
    block_reason: null,
    fee_type: "percent",
    fee_value: 0,
    fee_amount: 0,
    max_order_amount: null,
  },
  shipping = null,
  eta = null,
  defaultPayment = null,
  details,
  applyVoucherUrl,
  removeVoucherUrl,
  shippingQuoteUrl = null,
  shippingWeightKg = 1,
  insurance = false,
}: CheckoutProps) {
  const { errors: pageErrors = {} } = usePage<SharedPageProps>().props
  const [checkoutItems, setCheckoutItems] = React.useState(items)

  React.useEffect(() => {
    setCheckoutItems(items)
  }, [items])

  function updateCheckoutNote(lineId: string, note: string) {
    setCheckoutItems((current) => current.map((item) =>
      item.line_id === lineId ? { ...item, note } : item,
    ))
  }

  const c = useCheckout({
    details,
    cod,
    defaultPayment,
    voucher,
    voucherDiscount: voucher_discount,
    applyVoucherUrl,
    removeVoucherUrl,
    shippingQuoteUrl,
    shippingWeightKg,
    insurance,
  })

  if (!items.length) {
    return (
      <PublicLayout>
        <Head title="Checkout" />
        <section className="border-b border-border bg-surface">
          <div className="container-page hidden md:block py-2 !px-2.5 md:!px-8 lg:!px-12">
            <Breadcrumbs items={[{ label: "Beranda", href: routeUrl("home") }, { label: "Proses pesanan" }]} />
          </div>
          <div className="container-page py-2 !px-2.5 md:!px-8 lg:!px-12">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="-ml-2 flex size-11 shrink-0 items-center justify-center lg:hidden"
                aria-label="Kembali"
              >
                <Icon name="arrow-left" className="size-5" aria-hidden="true" />
              </button>
              <h1 className="text-base font-bold tracking-tight text-foreground">
                Proses pesanan
              </h1>
            </div>
          </div>
        </section>
        <section className="container-page !px-2.5 pt-4 pb-[calc(var(--mobile-bottom-nav-height)+var(--mobile-sticky-cta-height)+0.5rem)] md:!px-8 lg:!px-12 lg:pb-[calc(var(--mobile-sticky-cta-height)+1rem)]">
          <EmptyState
            icon="shopping-cart"
            title="Keranjang kosong"
            description="Tambahkan produk dan varian terlebih dahulu sebelum membuka checkout."
            action={
              <Button asChild>
                <Link href={routeUrl("catalog.index")}>Pilih Model Produk</Link>
              </Button>
            }
          />
        </section>
      </PublicLayout>
    )
  }

  // subtotal sudah berisi harga jual aktual setelah promo produk.
  // discount_total hanya tampilan potongan, jangan dikurangi lagi.
  // Pakai quote yang sama dengan CheckoutSummary agar total tunggal.
  const effectiveShipping = c.shippingQuote ?? (!c.shippingQuoteAttempted ? shipping : null)
  const shippingNet = Number(effectiveShipping?.net ?? 0)
  const codFee = c.showCodFee ? Number(cod?.fee_amount ?? 0) : 0
  const checkoutTotal = Math.max(
    0,
    Number(subtotal || 0) - Number(voucher_discount || 0) + shippingNet + codFee,
  )

  const steps = [
    { n: 1, label: "Detail pesanan", done: items.length > 0 },
    { n: 2, label: "Alamat pengiriman", done: details != null && !c.editingDetails },
    { n: 3, label: "Pembayaran", done: false },
  ]

  return (
    <PublicLayout>
      <Head title="Checkout" />

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden md:block py-2 !px-2.5 md:!px-8 lg:!px-12">
          <Breadcrumbs items={[{ label: "Beranda", href: routeUrl("home") }, { label: "Proses pesanan" }]} />
        </div>
        <div className="container-page py-2 !px-2.5 md:!px-8 lg:!px-12">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center lg:hidden"
              aria-label="Kembali"
            >
              <Icon name="arrow-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="text-base font-bold tracking-tight text-foreground">
              Proses pesanan
            </h1>
          </div>
        </div>
      </section>

      {/* Indikator langkah checkout */}
      <section className="border-b border-border bg-surface">
        <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
          <ol className="flex items-center justify-between gap-2 py-3" aria-label="Langkah checkout">
            {steps.map((step, idx) => {
              const active = !step.done && (idx === 0 || [0, 1].slice(0, idx).every((i) => steps[i].done))
              return (
                <li key={step.n} className="flex min-w-0 flex-1 items-center gap-2">
                  {idx > 0 ? <span className="h-px flex-1 bg-border" aria-hidden="true" /> : null}
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      step.done
                        ? "bg-primary text-primary-foreground"
                        : active
                          ? "border-2 border-primary text-primary"
                          : "border border-border text-muted-foreground",
                    )}
                  >
                    {step.done ? <Icon name="check" className="size-3" weight="bold" /> : step.n}
                  </span>
                  <span
                    className={cn(
                      "truncate text-xs font-semibold",
                      step.done || active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <section className="container-page !px-2.5 pt-4 pb-[calc(var(--mobile-bottom-nav-height)+var(--mobile-sticky-cta-height)+0.5rem)] md:!px-8 lg:!px-12 lg:pb-[calc(var(--mobile-sticky-cta-height)+1rem)]">
        {pageErrors.checkout ? (
          <Alert tone="danger" title={pageErrors.checkout} className="mb-4" />
        ) : null}
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div className="min-w-0 space-y-4">
            <CheckoutItemNotes items={checkoutItems} onChange={updateCheckoutNote} />
            <CheckoutAddressForm details={details ?? null} c={c} />
            <CheckoutPaymentSection
              details={details ?? null}
              editingDetails={c.editingDetails}
              cod={cod}
              pageErrors={pageErrors}
              c={c}
              total={checkoutTotal}
            />
          </div>

          <CheckoutSummary
            items={checkoutItems}
            subtotal={subtotal}
            discountTotal={discount_total}
            voucher={voucher}
            voucherDiscount={voucher_discount}
            cod={cod}
            shipping={shipping}
            eta={eta}
            pageErrors={pageErrors}
            c={c}
          />
        </div>
      </section>

      {/* Sticky bar bawah viewport: total + tombol submit form pembayaran.
          Gaya diseragamkan dengan MobileStickyCta di halaman lain (bar surface/95,
          bottom di atas bottom-nav, shadow & backdrop sama). */}
      {details && !c.editingDetails ? (
        <div
          role="region"
          aria-label="Buat pesanan"
          className="mobile-sticky-cta shadow-[0_-4px_16px_hsl(var(--foreground)/0.08)]"
        >
          <div className="mx-auto flex w-full max-w-lg">
            {/* Continuous segmented bar tanpa pill tombol terpisah - konsisten dgn PDP & cart */}
            <div className="flex w-full items-stretch min-h-14 divide-x divide-border overflow-hidden border-t border-border bg-surface">
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3">
                <span className="text-[10px] font-medium leading-3 text-muted-foreground">
                  Total Pembayaran
                </span>
                <span className="truncate tabular-nums text-sm font-bold leading-5 text-foreground">
                  {formatCurrency(checkoutTotal)}
                </span>
              </div>
              <button
                type="submit"
                form="checkout-payment-form"
                disabled={!details || c.editingDetails || c.paymentForm.processing}
                className="flex w-[45%] shrink-0 items-center justify-center gap-1.5 bg-primary px-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover active:bg-primary-hover/90 disabled:opacity-40 focus-visible:outline-none"
              >
                <span className="truncate">
                  {c.paymentForm.processing ? "Membuat pesanan..." : "Buat pesanan"}
                </span>
                <Icon name="arrow-right" className="size-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PublicLayout>
  )
}
