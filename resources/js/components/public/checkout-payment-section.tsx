import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { MobileStickyCta } from "@/components/public/mobile-sticky-cta"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { CheckoutCodConfig } from "@/hooks/use-checkout"
import type { CheckoutController } from "@/hooks/use-checkout"
import type { CheckoutDetails } from "@/types"

/**
 * Section 02 — Metode pembayaran (COD / transfer) + tombol buat pesanan
 * (desktop inline + sticky mobile). Status `details`/`editingDetails` dari page
 * menentukan teks dan disabled tombol; state dari `useCheckout` (§5 R).
 */
export function CheckoutPaymentSection({
  details,
  editingDetails,
  cod,
  pageErrors,
  c,
}: {
  details: CheckoutDetails | null
  editingDetails: boolean
  cod: CheckoutCodConfig
  pageErrors: Record<string, string>
  c: CheckoutController
}) {
  const { paymentForm, placeOrder } = c

  return (
    <section className="surface-panel min-w-0 p-5 sm:p-7">
      <p className="font-mono text-xs font-semibold text-primary">03</p>
      <h2 className="mt-2 text-lg font-semibold">Metode pembayaran</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Pilih metode sekarang — pilihan tersimpan otomatis dan dipakai saat pesanan dibuat.
      </p>
      {!details ? (
        <p className="mt-3 rounded-md bg-accent/60 px-3 py-2 text-xs leading-5 text-accent-foreground">
          Lengkapi detail pengiriman di atas untuk menghitung ongkir sebelum pesanan dibuat.
        </p>
      ) : null}
      <form onSubmit={placeOrder} className="mt-4">
        <fieldset disabled={paymentForm.processing}>
          <legend className="sr-only">Metode pembayaran</legend>
          <div className="grid gap-3">
            {(
              [
                [
                  "cod",
                  "Bayar di tempat (COD)",
                  cod.enabled && cod.allowed
                    ? cod.fee_amount > 0
                      ? `Termasuk biaya penanganan ${formatCurrency(cod.fee_amount)}.`
                      : "Pembayaran dicatat menunggu saat pesanan dibuat."
                    : cod.block_reason || "Layanan COD sedang tidak tersedia.",
                  cod.enabled && cod.allowed,
                ],
                [
                  "transfer",
                  "Transfer bank",
                  "Instruksi lanjutan mengikuti konfirmasi pesanan.",
                  true,
                ],
              ] as const
            ).map(([value, label, description, allowed]) => (
              <label
                key={value}
                className={cn(
                  "flex gap-4 rounded-lg border p-4 transition",
                  allowed ? "cursor-pointer" : "cursor-not-allowed opacity-55",
                  paymentForm.data.payment_method === value
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface hover:bg-accent",
                )}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value={value}
                  checked={paymentForm.data.payment_method === value}
                  disabled={!allowed}
                  onChange={() => paymentForm.setData("payment_method", value)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground break-words">
                    {description}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {pageErrors.payment_method ? (
            <p className="mt-3 text-xs font-medium text-destructive">{pageErrors.payment_method}</p>
          ) : null}
        </fieldset>
        {paymentForm.errors.payment_method ? (
          <p className="mt-3 text-xs font-medium text-destructive">
            {paymentForm.errors.payment_method}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="mt-4 hidden h-12 w-full lg:inline-flex"
          disabled={!details || editingDetails || paymentForm.processing}
        >
          {paymentForm.processing
            ? "Membuat pesanan..."
            : !details
              ? "Lengkapi alamat dulu"
              : "Buat pesanan"}
          <Icon name="arrow-right" className="h-5 w-5" aria-hidden="true" />
        </Button>

        {details && !editingDetails ? (
          <MobileStickyCta aria-label="Buat pesanan" spacerClassName="h-[4.5rem]">
            <Button
              type="submit"
              size="lg"
              className="h-11 min-h-11 w-full"
              disabled={paymentForm.processing}
            >
              {paymentForm.processing ? "Membuat pesanan..." : "Buat pesanan"}
              <Icon name="arrow-right" className="h-5 w-5" aria-hidden="true" />
            </Button>
          </MobileStickyCta>
        ) : null}
      </form>
    </section>
  )
}
