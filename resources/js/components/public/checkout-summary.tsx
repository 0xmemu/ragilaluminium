import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TrustAssuranceCard } from "@/components/public/trust-assurance-card"
import { formatCurrency } from "@/lib/format"
import type { CheckoutCodConfig, CheckoutController, CheckoutVoucher } from "@/hooks/use-checkout"
import type { OrderEta } from "@/types"

export interface CheckoutItem {
  line_id: string
  name: string
  quantity: number
  line_total: number
  unit_price?: number
  compare_price?: number | null
  discount_percent?: number | null
  line_compare_total?: number | null
  line_discount?: number
  flash_sale?: boolean
  note?: string | null
}

export interface CheckoutShipping {
  gross: number
  subsidy: number
  net: number
  applied: boolean
}

/**
 * Aside "Ringkasan pesanan": daftar item, voucher, rincian harga (subtotal,
 * potongan, COD, ongkir asli/subsidi, estimasi tiba), dan jaminan belanja.
 * UI voucher (buka/tutup, input kode) hidup di sini, state dari `useCheckout`.
 */
export function CheckoutSummary({
  items,
  subtotal,
  discountTotal,
  voucher,
  voucherDiscount,
  cod,
  shipping,
  eta,
  pageErrors,
  c,
}: {
  items: CheckoutItem[]
  subtotal: number
  discountTotal: number
  voucher?: CheckoutVoucher | null
  voucherDiscount: number
  cod: CheckoutCodConfig
  shipping?: CheckoutShipping | null
  eta?: OrderEta | null
  pageErrors: Record<string, string>
  c: CheckoutController
}) {
  const {
    hasVoucher,
    showCodFee,
    voucherCode,
    setVoucherCode,
    voucherOpen,
    setVoucherOpen,
    voucherForm,
    applyVoucher,
    removeVoucher,
  } = c
  const hasDiscount = discountTotal > 0

  return (
    <aside className="surface-panel min-w-0 p-5 lg:sticky lg:top-28">
      <h2 className="text-lg font-semibold">Ringkasan pesanan</h2>
      <ul className="mt-4 divide-y divide-border border-y border-border">
        {items.map((item) => {
          const lineTotal = Number(item.line_total ?? 0)
          const lineDiscount = Number(item.line_discount ?? 0)
          const comparePrice =
            item.compare_price == null ? null : Number(item.compare_price)
          const hasLineDiscount =
            lineDiscount > 0 ||
            (comparePrice !== null && comparePrice > Number(item.unit_price ?? 0))
          const lineCompare =
            item.line_compare_total != null
              ? Number(item.line_compare_total)
              : hasLineDiscount && comparePrice != null
                ? comparePrice * item.quantity
                : null
          const discountPercent = item.discount_percent

          return (
            <li key={item.line_id} className="flex justify-between gap-4 py-3 text-xs">
              <span className="min-w-0">
                <span className="font-semibold leading-5 break-words [overflow-wrap:anywhere]">{item.name}</span>
                <span className="tabular-nums mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{item.quantity} item</span>
                  {item.flash_sale ? (
                    <span className="font-extrabold italic tracking-tight text-sale">
                      Flash Sale
                    </span>
                  ) : null}
                  {discountPercent ? (
                    <span className="rounded bg-accent px-1.5 text-xs font-semibold leading-5 text-accent-foreground">
                      −{discountPercent}%
                    </span>
                  ) : null}
                </span>
                {item.note ? (
                  <span className="mt-1.5 block max-w-full break-words rounded-md bg-accent/60 px-2 py-1 text-[11px] leading-4 text-accent-foreground">
                    <span className="font-semibold">Catatan:</span> {item.note}
                  </span>
                ) : null}
                {hasLineDiscount ? (
                  <span className="mt-1 block text-xs font-semibold text-sale">
                    Hemat {formatCurrency(lineDiscount)}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-right">
                {hasLineDiscount && lineCompare != null ? (
                  <span className="tabular-nums block text-xs text-muted-foreground line-through">
                    {formatCurrency(lineCompare)}
                  </span>
                ) : null}
                <span
                  className={
                    hasLineDiscount
                      ? "tabular-nums block font-bold text-sale"
                      : "tabular-nums block font-semibold"
                  }
                >
                  {formatCurrency(lineTotal)}
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      <div className="mt-4 border-t border-border pt-4">
        {hasVoucher ? (
          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
            <p className="inline-flex items-center gap-2 text-sm font-semibold">
              <Icon name="ticket" className="size-4 shrink-0 text-primary" weight="bold" aria-hidden="true" />
              Voucher diterapkan
            </p>
            {(voucher?.vouchers ?? (voucher ? [voucher] : [])).map((item) => (
              <div key={item.code} className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-semibold">{item.code}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.name} · Hemat {formatCurrency(item.discount)}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-destructive hover:underline"
                  onClick={() => removeVoucher(item.code)}
                  disabled={voucherForm.processing}
                >
                  Hapus
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => setVoucherOpen(true)}
            >
              Tambah voucher
            </button>
          </div>
        ) : !voucherOpen ? (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:text-primary/80"
            onClick={() => setVoucherOpen(true)}
          >
            <Icon name="ticket" className="size-4 shrink-0" weight="bold" aria-hidden="true" />
            Masukkan voucher
          </button>
        ) : (
          <form onSubmit={applyVoucher} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="checkout-voucher"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground"
              >
                <Icon name="ticket" className="size-4 shrink-0 text-primary" weight="bold" aria-hidden="true" />
                Masukkan voucher
              </label>
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setVoucherOpen(false)
                  setVoucherCode("")
                  voucherForm.clearErrors()
                }}
              >
                Tutup
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                id="checkout-voucher"
                value={voucherCode}
                onChange={(event) => {
                  setVoucherCode(event.target.value.toUpperCase())
                  voucherForm.clearErrors("code")
                }}
                placeholder="Kode voucher"
                autoComplete="off"
                autoFocus
                className="min-w-0 flex-1 font-mono uppercase"
              />
              <Button type="submit" className="shrink-0" disabled={voucherForm.processing}>
                {voucherForm.processing ? "..." : "Pakai"}
              </Button>
            </div>
            {voucherForm.errors.code || pageErrors.voucher ? (
              <p className="text-xs font-medium text-destructive">
                {voucherForm.errors.code || pageErrors.voucher}
              </p>
            ) : null}
          </form>
        )}
      </div>

      <dl className="mt-4 space-y-3 text-xs">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground min-w-0 break-words">Subtotal</dt>
          <dd className="tabular-nums font-semibold">{formatCurrency(subtotal)}</dd>
        </div>
        {hasDiscount ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground min-w-0 break-words">Potongan harga</dt>
            <dd className="tabular-nums font-semibold text-sale">
              −{formatCurrency(discountTotal)}
            </dd>
          </div>
        ) : null}
        {hasVoucher ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground min-w-0 break-words">Voucher ({voucher?.code})</dt>
            <dd className="tabular-nums font-semibold text-sale">
              −{formatCurrency(voucherDiscount)}
            </dd>
          </div>
        ) : null}
        {showCodFee ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground min-w-0 break-words">Biaya COD</dt>
            <dd className="tabular-nums font-semibold">{formatCurrency(cod.fee_amount)}</dd>
          </div>
        ) : null}
        {shipping ? (
          <>
            {shipping.applied && shipping.subsidy > 0 ? (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground min-w-0 break-words">Ongkir asli (tarif kurir)</dt>
                  <dd className="tabular-nums text-muted-foreground line-through">
                    {formatCurrency(shipping.gross)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground min-w-0 break-words">Subsidi ongkir</dt>
                  <dd className="tabular-nums font-semibold text-sale">
                    −{formatCurrency(shipping.subsidy)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground min-w-0 break-words">Ongkir dibayar</dt>
                  <dd className="tabular-nums font-bold text-foreground">
                    {formatCurrency(shipping.net)}
                  </dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground min-w-0 break-words">Pengiriman</dt>
                <dd className="tabular-nums font-semibold">{formatCurrency(shipping.net)}</dd>
              </div>
            )}
          </>
        ) : (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground min-w-0 break-words">Pengiriman</dt>
            <dd className="text-right font-semibold shrink-0">Dihitung dari alamat</dd>
          </div>
        )}

        {eta ? (
          <div className="flex justify-between gap-4 border-t border-border pt-3">
            <dt className="text-muted-foreground min-w-0 break-words">Estimasi tiba</dt>
            <dd className="text-right font-semibold text-primary">{eta.range_label}</dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
        Estimasi = {eta?.production_days ?? 1} hari produksi + {eta?.min_days ?? 2}–
        {eta?.max_days ?? 5} hari pengiriman, dihitung sejak pesanan dibuat.
      </p>

      <TrustAssuranceCard className="mt-4" />
      <Alert tone="info" className="mt-4">
        Total akhir dan nomor pesanan ditampilkan setelah konfirmasi berhasil.
      </Alert>
    </aside>
  )
}
