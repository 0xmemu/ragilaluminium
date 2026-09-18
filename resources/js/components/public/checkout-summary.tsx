import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { TrustAssuranceCard } from "@/components/public/trust-assurance-card"
import { formatCurrency, formatNumber } from "@/lib/format"
import { displayEtaRangeLabel } from "@/lib/order-eta-display"
import { cn } from "@/lib/utils"
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
  image?: string | null
  variation_1_name?: string | null
  variation_1_option?: string | null
  variation_2_name?: string | null
  variation_2_option?: string | null
  note?: string | null
}

export interface CheckoutShipping {
  gross: number
  subsidy: number
  net: number
  applied: boolean
  status?: string
  provisional?: boolean
  freight?: number
  /** Biaya asuransi dari J&T; sudah termasuk di dalam `gross` dan `net`. */
  insurance?: number
  insured_value?: number
  message?: string | null
  carrier_eta?: string | null
}

/** Parse ETA J&T "1-3" atau "3" menjadi {min,max}; null bila tidak valid. */
function parseCarrierEta(value: string | null | undefined): { min: number; max: number } | null {
  const raw = (value ?? "").trim()
  if (!raw) return null
  const range = raw.match(/^(\d+)\s*-\s*(\d+)$/)
  if (range) {
    const min = Math.max(1, Number(range[1]))
    const max = Math.max(min, Number(range[2]))
    return { min, max }
  }
  if (/^\d+$/.test(raw)) {
    const days = Math.max(1, Number(raw))
    return { min: days, max: days }
  }
  return null
}


function formatPercent(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",")
  return text + "%"
}

export function CheckoutSummary({
  items,
  subtotal,
  compareSubtotal = 0,
  discountTotal,
  voucher,
  voucherDiscount,
  cod,
  shipping = null,
  eta = null,
  pageErrors,
  c,
}: {
  items: CheckoutItem[]
  subtotal: number
  /** Harga sebelum potongan (harga coret), dari compare_price tiap baris. */
  compareSubtotal?: number
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
    voucherCode,
    setVoucherCode,
    voucherOpen,
    setVoucherOpen,
    voucherForm,
    applyVoucher,
    removeVoucher,
    showCodFee,
    shippingQuote,
    shippingQuoteLoading,
    shippingQuoteAttempted,
  } = c
  const effectiveShipping = shippingQuote ?? (!shippingQuoteAttempted ? shipping : null)
  // Harga asli ditampilkan tercoret di bawah subtotal. `subtotal` dari server
  // SUDAH termasuk potongan, jadi harga aslinya = compare_subtotal bila ada,
  // atau subtotal + potongan produk bila compare_price tidak diisi. Tanpa
  // fallback ini potongan produk bisa tidak terlihat sama sekali.
  const subtotalOriginal = Math.max(
    compareSubtotal,
    Number(subtotal || 0) + Number(discountTotal || 0),
  )
  const hasCompareSubtotal = subtotalOriginal > Number(subtotal || 0)

  const shippingCost = effectiveShipping ? Number(effectiveShipping.net || 0) : 0
  const codFee = showCodFee ? Number(cod.fee_amount || 0) : 0
  const discount = Number(discountTotal || 0) + (hasVoucher ? Number(voucherDiscount || 0) : 0)
  // Nilai yang ditampilkan sebagai penghematan harus benar-benar selisih
  // antara total sebelum seluruh diskon dan total pembayaran akhir.
  const finalTotal = Math.max(0, Number(subtotal || 0) - (hasVoucher ? Number(voucherDiscount || 0) : 0) + shippingCost + codFee)
  const shippingSubsidy = effectiveShipping ? Number(effectiveShipping.subsidy || 0) : 0
  // Angka ongkir dan asuransi dipakai apa adanya dari J&T.
  // Asuransi TIDAK LAGI pilihan pembeli (keputusan owner 2026-09-18):
  // pengiriman toko selalu diasuransikan, biayanya menyatu ke tarif ongkir.
  // TIDAK ada rumus asuransi di sini; kalau J&T tidak mengirim biayanya,
  // tidak ada angka yang dikarang.
  const shippingFreight = effectiveShipping ? Number(effectiveShipping.freight || 0) : 0
  const insuranceCost = Number(effectiveShipping?.insurance || 0)
  // Harga ongkir SEBELUM subsidi (sudah termasuk asuransi). Ditampilkan
  // tercoret di bawah angka yang dibayar, pola yang sama dengan Subtotal
  // Produk: angka atas = yang dibayar, angka bawah = harga asli.
  const shippingTariff = effectiveShipping
    ? Number(effectiveShipping.gross || 0) || shippingFreight + insuranceCost
    : 0
  // Subsidi ongkir menyatu ke label "Ongkos Kirim (subsidi 10%)" sebagai
  // persentase, bukan baris terpisah, sehingga pembeli tidak melihat ongkir
  // muncul dua kali.
  const shippingSubsidyPercent =
    shippingSubsidy > 0 && shippingFreight > 0
      ? Math.round((shippingSubsidy / shippingFreight) * 100)
      : 0
  // Harga coret hanya bila memang ada selisih yang dibayar.
  const shippingHasCompare =
    effectiveShipping !== null && shippingTariff > Number(effectiveShipping?.net || 0)
  const totalBeforeDiscount = finalTotal + discount + shippingSubsidy
  const savedAmount = Math.max(0, totalBeforeDiscount - finalTotal)

  // Estimasi tiba = ETA J&T utk rute (carrier_eta); +1 hari hanya di batas lambat.
  // Fallback: pakai rentang dasar dari props eta (konfigurasi) saat J&T belum menghitung.
  const liveEta = React.useMemo(() => {
    if (!eta) return null
    const carrierEta = (effectiveShipping as { carrier_eta?: string | null } | null)?.carrier_eta ?? null
    const base = carrierEta
      ? parseCarrierEta(carrierEta)
      : { min: (eta as { base_min_days?: number }).base_min_days ?? 2, max: (eta as { base_max_days?: number }).base_max_days ?? 5 }
    if (!base) return eta
    // Kontrak owner: min = ETA J&T, max = J&T + 1 hari (buffer hanya di batas lambat).
    const start = new Date()
    start.setDate(start.getDate() + base.min)
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setDate(end.getDate() + base.max + 1)
    end.setHours(23, 59, 59, 0)
    return { ...eta, start_at: start.toISOString(), end_at: end.toISOString(), carrier_eta: carrierEta }
  }, [eta, effectiveShipping])

  return (
    <aside className="surface-panel min-w-0 p-4 sm:p-5 lg:sticky lg:top-28">
      <h2 className="text-sm sm:text-base font-bold text-foreground">Ringkasan Pesanan</h2>
      <ul className="mt-3 divide-y divide-border border-y border-border">
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
          const variantText = [item.variation_1_option, item.variation_2_option].filter(Boolean).join(" / ")

          return (
            <li key={item.line_id} className="flex justify-between gap-3 py-2.5 text-xs">
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug break-words [overflow-wrap:anywhere] text-foreground">
                  {item.name}
                </p>
                <p className="tabular-nums mt-0.5 text-[11px] text-muted-foreground">
                  <span>{item.quantity} unit</span>
                  {variantText ? <span> · {variantText}</span> : null}
                </p>
                {discountPercent ? (
                  <span className="mt-1 inline-block rounded bg-accent px-1.5 text-[10px] font-semibold leading-4 text-accent-foreground">
                    Hemat {discountPercent}%
                  </span>
                ) : null}
                {hasLineDiscount ? (
                  <span className="mt-1 block text-[11px] text-sale">
                    Hemat {formatCurrency(lineDiscount)}
                  </span>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                {hasLineDiscount && lineCompare != null ? (
                  <span className="tabular-nums block text-[11px] text-muted-foreground line-through">
                    {formatCurrency(lineCompare)}
                  </span>
                ) : null}
                <span
                  className={
                    hasLineDiscount
                      ? "tabular-nums block font-bold text-sale"
                      : "tabular-nums block font-semibold text-foreground"
                  }
                >
                  {formatCurrency(lineTotal)}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Embedded Voucher Action Box */}
      <div className="mt-3 rounded-md border border-border bg-surface-muted/40 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Icon name="ticket" className="size-3.5 shrink-0 text-primary" weight="bold" aria-hidden="true" />
            <span>{hasVoucher ? `Voucher (${voucher?.code})` : "Voucher Toko"}</span>
          </div>
          {!voucherOpen && (
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 text-xs font-semibold hover:underline",
                hasVoucher ? "text-destructive" : "text-primary"
              )}
              onClick={() => {
                if (hasVoucher && voucher?.code) {
                  removeVoucher(voucher.code)
                } else {
                  setVoucherOpen(true)
                }
              }}
            >
              {hasVoucher ? (
                "Hapus"
              ) : (
                <>
                  <Icon name="plus" className="size-3 shrink-0" weight="bold" aria-hidden="true" />
                  Tambah voucher
                </>
              )}
            </button>
          )}
        </div>

        {hasVoucher ? (
          <div className="mt-0.5 space-y-1 text-[11px] text-muted-foreground">
            {voucher?.vouchers?.length ? (
              voucher.vouchers.map((entry) => (
                <p key={entry.code} className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-words">
                    {entry.name}
                    {entry.discount_percent != null ? (
                      <span className="font-medium text-primary"> · {formatPercent(entry.discount_percent)}</span>
                    ) : null}
                    {entry.target_label && entry.target_label !== "Semua produk" ? (
                      <span className="font-medium text-primary"> · {entry.target_label}</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums shrink-0 font-semibold text-foreground">
                    Hemat {formatCurrency(entry.discount)}
                  </span>
                </p>
              ))
            ) : (
              <p>
                {voucher?.name} · Hemat {formatCurrency(voucherDiscount)}
              </p>
            )}
          </div>
        ) : null}

        {voucherOpen && !hasVoucher ? (
          <form onSubmit={applyVoucher} className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <input
                id="summary-voucher"
                type="text"
                value={voucherCode}
                onChange={(event) => {
                  setVoucherCode(event.target.value.toUpperCase())
                  voucherForm.clearErrors("code")
                }}
                placeholder="KODE VOUCHER"
                autoComplete="off"
                autoFocus
                className="h-7 min-w-0 flex-1 rounded border border-input bg-surface px-2 text-xs font-mono uppercase text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={voucherForm.processing || !voucherCode.trim()}
                className="h-7 shrink-0 rounded bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none disabled:opacity-50"
              >
                {voucherForm.processing ? "..." : "Pakai"}
              </button>
              <button
                type="button"
                className="h-7 shrink-0 px-1 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setVoucherOpen(false)
                  setVoucherCode("")
                  voucherForm.clearErrors()
                }}
              >
                Batal
              </button>
            </div>
            {voucherForm.errors.code || pageErrors.voucher ? (
              <p className="text-[11px] font-medium text-destructive">
                {voucherForm.errors.code || pageErrors.voucher}
              </p>
            ) : null}
          </form>
        ) : null}
      </div>

      <dl className="mt-3 space-y-3 text-xs">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground min-w-0 break-words">Subtotal Produk ({items.reduce((total, item) => total + Number(item.quantity || 0), 0)} unit)</dt>
          <dd className="text-right">
            <span className="tabular-nums block font-semibold">{formatCurrency(subtotal)}</span>
            {hasCompareSubtotal ? (
              <span className="tabular-nums block text-[11px] text-muted-foreground line-through">
                {formatCurrency(subtotalOriginal)}
              </span>
            ) : null}
          </dd>
        </div>
        {hasVoucher ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground min-w-0 break-words">Diskon Voucher</dt>
            <dd className="tabular-nums font-bold text-sale">
              -{formatCurrency(voucherDiscount)}
            </dd>
          </div>
        ) : null}
        {showCodFee ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground min-w-0 break-words">
              Biaya COD{cod.fee_type === "percent" ? ` (${formatNumber(cod.fee_value)}%)` : ""}
            </dt>
            <dd className="tabular-nums font-semibold">{formatCurrency(cod.fee_amount)}</dd>
          </div>
        ) : null}
        {shippingQuoteLoading ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground min-w-0 break-words">Pengiriman</dt>
            <dd className="shrink-0 text-right font-semibold">Menghitung ongkir…</dd>
          </div>
        ) : effectiveShipping?.provisional ? (
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground min-w-0 break-words">Estimasi ongkir sementara</dt>
              <dd className="tabular-nums font-bold">{formatCurrency(effectiveShipping.net)}</dd>
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Estimasi sementara. Ongkir final dikonfirmasi admin setelah pesanan masuk.
            </p>
          </div>
        ) : effectiveShipping ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground min-w-0 break-words">
              Ongkos Kirim{shippingSubsidyPercent > 0 ? ` (subsidi ${shippingSubsidyPercent}%)` : ""}
            </dt>
            <dd className="text-right">
              <span className="tabular-nums block font-semibold">{formatCurrency(effectiveShipping.net)}</span>
              {shippingHasCompare ? (
                <span className="tabular-nums block text-[11px] text-muted-foreground line-through">
                  {formatCurrency(shippingTariff)}
                </span>
              ) : null}
            </dd>
          </div>
        ) : (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground min-w-0 break-words">Ongkos Kirim</dt>
            <dd className="text-right font-semibold shrink-0 text-muted-foreground">
              {shippingQuoteAttempted ? "Dihitung saat konfirmasi" : "Lengkapi alamat untuk menghitung"}
            </dd>
          </div>
        )}

        {liveEta ? (
          <div className="flex justify-between gap-4 border-t border-border pt-2.5">
            <dt className="text-muted-foreground min-w-0 break-words">Estimasi tiba</dt>
            <dd className="text-right font-semibold text-primary">{liveEta ? displayEtaRangeLabel(liveEta) : null}</dd>
          </div>
        ) : null}

        <div className="flex justify-between gap-4 border-t border-border pt-3">
          <dt className="text-sm font-bold text-foreground">Total Pembayaran</dt>
          <dd className="tabular-nums text-base font-bold text-primary">
            {formatCurrency(finalTotal)}
          </dd>
        </div>
        {discount > 0 ? (
          <p className="mt-1 text-right text-[11px] leading-4 text-sale">
            Anda menghemat {formatCurrency(savedAmount)}
          </p>
        ) : null}
      </dl>

      <TrustAssuranceCard className="mt-2.5" />
    </aside>
  )
}
