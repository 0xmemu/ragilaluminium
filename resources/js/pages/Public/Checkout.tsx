import { Head, Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { CheckoutAddressForm } from "@/components/public/checkout-address-form"
import { CheckoutItemNotes } from "@/components/public/checkout-item-notes"
import { CheckoutPaymentSection } from "@/components/public/checkout-payment-section"
import { CheckoutSummary, type CheckoutItem } from "@/components/public/checkout-summary"
import { LocationPickerModal } from "@/components/public/location-picker"
import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { useCheckout, type CheckoutCodConfig } from "@/hooks/use-checkout"
import PublicLayout from "@/layouts/public-layout"
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
}

/**
 * Halaman checkout — murni komposisi. State & aksi (form detail, wilayah,
 * voucher, metode bayar) di `useCheckout`; tiap section (alamat, pembayaran,
 * ringkasan) adalah komponen props-only (§5 R).
 */
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
}: CheckoutProps) {
  const { errors: pageErrors = {} } = usePage<SharedPageProps>().props
  const [checkoutItems, setCheckoutItems] = React.useState(items)

  React.useEffect(() => {
    // Sync server-provided lines after voucher/address redirects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  })

  if (!items.length) {
    return (
      <PublicLayout>
        <Head title="Checkout" />
        <section className="container-page !px-5 pt-4 pb-[calc(var(--mobile-bottom-nav-height)+var(--mobile-sticky-cta-height)+1rem)] md:!px-8 lg:!px-12 lg:py-8">
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

  return (
    <PublicLayout>
      <Head title="Checkout" />

      <section className="border-b border-border bg-surface">
        <div className="container-page py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
              aria-label="Kembali"
            >
              <Icon name="arrow-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="text-base font-bold tracking-tight text-foreground">
              Proses pesanan
            </h1>
          </div>
          <ol className="mt-4 grid max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
            <li className="bg-surface p-4">
              <p className="font-mono text-[11px] text-primary">01</p>
              <p className="mt-1 text-sm font-semibold">Catatan produk</p>
            </li>
            <li className="bg-surface p-4">
              <p className="font-mono text-[11px] text-primary">02</p>
              <p className="mt-1 text-sm font-semibold">Detail pengiriman</p>
            </li>
            <li className={cn("p-4", details ? "bg-surface" : "bg-surface-muted")}>
              <p className="font-mono text-[11px] text-primary">03</p>
              <p className="mt-1 text-sm font-semibold">Pembayaran dan konfirmasi</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="container-page !px-5 pt-4 pb-[calc(var(--mobile-bottom-nav-height)+var(--mobile-sticky-cta-height)+1rem)] md:!px-8 lg:!px-12 lg:py-8">
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

      <LocationPickerModal
        open={c.mapPickerOpen}
        onOpenChange={c.setMapPickerOpen}
        provinces={c.provinces}
        regencies={c.regencies}
        districts={c.districts}
        villages={c.villages}
        onApply={c.applyPickedLocation}
      />
    </PublicLayout>
  )
}
