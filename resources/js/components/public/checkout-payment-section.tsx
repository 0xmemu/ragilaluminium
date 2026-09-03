import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { Radio } from "@/components/ui/radio"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { CheckoutCodConfig } from "@/hooks/use-checkout"
import type { CheckoutController } from "@/hooks/use-checkout"
import type { CheckoutDetails } from "@/types"

export function CheckoutPaymentSection({
  details,
  editingDetails,
  cod,
  pageErrors,
  c,
  total,
}: {
  details: CheckoutDetails | null
  editingDetails: boolean
  cod: CheckoutCodConfig
  pageErrors: Record<string, string>
  c: CheckoutController
  /** Total pembayaran untuk sticky bar (tampil semua breakpoint). */
  total: number
}) {
  const { paymentForm, placeOrder } = c

  return (
    <section className="surface-panel min-w-0 p-4 sm:p-5">
      <h2 className="text-sm sm:text-base font-bold text-foreground">Metode Pembayaran</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Pilih metode sekarang. Pilihan tersimpan otomatis dan dipakai saat pesanan dibuat.
      </p>
      {!details ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs leading-5 text-destructive">
          <Icon name="info" className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>Lengkapi detail pengiriman di atas untuk cek ketersediaan COD dan perhitungan ongkir sebelum pesanan dibuat.</span>
        </div>
      ) : null}
      <form id="checkout-payment-form" onSubmit={placeOrder} className="mt-4">
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
              <Radio
                key={value}
                name="payment_method"
                value={value}
                checked={paymentForm.data.payment_method === value}
                disabled={!allowed}
                onChange={() => paymentForm.setData("payment_method", value)}
                className={cn(
                  "flex gap-3 rounded-lg border p-3.5 transition",
                  allowed ? "cursor-pointer" : "cursor-not-allowed opacity-55",
                  paymentForm.data.payment_method === value
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface hover:bg-surface-muted",
                )}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold sm:text-sm text-foreground">{label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground break-words">
                    {description}
                  </span>
                </span>
              </Radio>
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
      </form>
    </section>
  )
}
