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
  /** Persentase subsidi ongkir dari setelan toko (mis. 10 untuk 10%). */
  subsidy_percent?: number
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
  // muncul dua kali. Persentasenya diambil dari setelan toko yang dikirim
  // server, bukan dihitung balik, supaya angka pecahan tidak dibulatkan salah.
  const shippingSubsidyPercent =
    shippingSubsidy > 0 ? Number(effectiveShipping?.subsidy_percent || 0) : 0
  // Harga coret hanya bila memang ada selisih yang dibayar.
  const shippingHasCompare =
    effectiveShipping !== null && shippingTariff > Number(effectiveShipping?.net || 0)
  // Identitas voucher untuk baris atas kotak voucher: satu entri per voucher
  // yang dipakai (dukung penumpukan), berisi nama, persentase, dan sasaran.
  const voucherIdentity: Array<{ key: string; name: string; percent: number | null; target: string | null }> =
    voucher?.vouchers?.length
      ? voucher.vouchers.map((entry, index) => ({
          key: entry.code || `voucher-${index}`,
          name: entry.name,
          percent: entry.discount_percent ?? null,
          target: entry.target_label && entry.target_label !== "Semua produk" ? entry.target_label : null,
        }))
      : voucher?.name || voucher?.code
        ? [{
            key: voucher.code ?? "voucher",
            name: voucher.name || voucher.code || "Voucher",
            percent: null,
            target: null,
          }]
        : []

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
    <aside className="surface-panel min-w-0 p-4 sm:p-5 lg:sticky lg:top-28 lg:max-h-[calc(100vh_-_8rem)] lg:overflow-y-auto lg:overscroll-contain">
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
            <li key={item.line_id} className="py-2.5 text-xs">
              {/* Dua blok: kiri identitas produk, kanan rincian harga.
                  Di layar sempit keduanya bertumpuk dan rata KIRI, sesuai
                  perilaku baca mobile. Dari breakpoint sm ke atas keduanya
                  berdampingan dengan harga rata kanan, mengikuti tepi angka
                  pada rincian biaya di bawahnya. */}
              <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-[13px] font-semibold leading-snug break-words [overflow-wrap:anywhere] text-foreground">
                    {item.name}
                  </p>
                  {/* Tanpa truncate: panel ringkasan hanya selebar 247px,
                      sehingga memotong teks akan menyembunyikan nama varian
                      yang justru dipilih pembeli. */}
                  <p className="tabular-nums text-[11px] text-muted-foreground">
                    <span>{item.quantity} unit</span>
                    {variantText ? <span> · {variantText}</span> : null}
                  </p>
                </div>
                <div className="shrink-0 space-y-0.5 sm:text-right">
                  <span className="tabular-nums block font-bold text-foreground">
                    {formatCurrency(lineTotal)}
                  </span>
                  {hasLineDiscount && lineCompare != null ? (
                    <span className="flex items-baseline gap-1.5 sm:justify-end">
                      {discountPercent ? (
                        <span className="text-[11px] font-semibold text-sale">
                          {discountPercent}%
                        </span>
                      ) : null}
                      <span className="tabular-nums text-[11px] text-muted-foreground line-through">
                        {formatCurrency(lineCompare)}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Embedded Voucher Action Box */}
      <div className="mt-3 rounded-md border border-border bg-surface-muted/40 px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          {hasVoucher ? (
            /* Identitas voucher tampil di baris atas ini: nama, persentase,
               dan sasaran berlakunya. Nominal potongannya tidak diulang di
               sini karena sudah ada baris "Diskon Voucher" di ringkasan. */
            <div className="inline-flex min-w-0 items-start gap-1.5 text-xs font-semibold text-foreground">
              <Icon name="ticket" className="mt-0.5 size-3.5 shrink-0 text-primary" weight="bold" aria-hidden="true" />
              <span className="min-w-0 space-y-0.5">
                {voucherIdentity.map((entry) => (
                  <span key={entry.key} className="block break-words">
                    {entry.name}
                    {entry.percent != null ? (
                      <span className="font-medium text-primary"> · {formatPercent(entry.percent)}</span>
                    ) : null}
                    {entry.target ? (
                      <span className="font-medium text-primary"> · {entry.target}</span>
                    ) : null}
                  </span>
                ))}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Icon name="ticket" className="size-3.5 shrink-0 text-primary" weight="bold" aria-hidden="true" />
              <span>Voucher Toko</span>
            </div>
          )}
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

      <dl className="mt-3 space-y-2.5 text-xs">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground min-w-0 break-words">Subtotal Produk ({items.reduce((total, item) => total + Number(item.quantity || 0), 0)} unit)</dt>
          <dd className="tabular-nums text-right font-semibold">{formatCurrency(subtotal)}</dd>
        </div>
        {hasVoucher ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground min-w-0 break-words">Diskon Voucher</dt>
            <dd className="tabular-nums font-bold text-sale">
              -{formatCurrency(voucherDiscount)}
            </dd>
          </div>
        ) : null}
        {shippingQuoteLoading ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground min-w-0 break-words">Ongkos Kirim</dt>
            <dd className="shrink-0 text-right font-semibold">Menghitung ongkir…</dd>
          </div>
        ) : effectiveShipping?.provisional ? (
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground min-w-0 break-words">Ongkos Kirim</dt>
              <dd className="tabular-nums font-bold">{formatCurrency(effectiveShipping.net)}</dd>
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Estimasi sementara. Ongkir final dikonfirmasi admin setelah pesanan masuk.
            </p>
          </div>
        ) : effectiveShipping ? (
          <>
            {/* Pola transparan: tarif kurir, potongan subsidi, lalu yang
                benar-benar dibayar. Ketiganya bisa dijumlahkan pembeli:
                tarif - subsidi = ongkir dibayar. */}
            {shippingHasCompare ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground min-w-0 break-words">Tarif Ongkir</dt>
                <dd className="tabular-nums text-right text-muted-foreground line-through">
                  {formatCurrency(shippingTariff)}
                </dd>
              </div>
            ) : null}
            {shippingSubsidy > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground min-w-0 break-words">
                  Subsidi Ongkir
                  {shippingSubsidyPercent > 0 ? ` ${formatPercent(shippingSubsidyPercent)}` : ""}
                </dt>
                <dd className="tabular-nums text-right font-semibold text-sale">
                  -{formatCurrency(shippingSubsidy)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="min-w-0 break-words font-semibold text-foreground">Ongkir dibayar</dt>
              <dd className="tabular-nums text-right font-semibold text-foreground">
                {formatCurrency(effectiveShipping.net)}
              </dd>
            </div>
          </>
        ) : (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground min-w-0 break-words">Ongkos Kirim</dt>
            <dd className="text-right font-semibold shrink-0 text-muted-foreground">
              {shippingQuoteAttempted ? "Dihitung saat konfirmasi" : "Lengkapi alamat untuk menghitung"}
            </dd>
          </div>
        )}

        {showCodFee ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground min-w-0 break-words">
              Biaya COD{cod.fee_type === "percent" ? ` ${formatNumber(cod.fee_value)}%` : ""}
            </dt>
            <dd className="tabular-nums font-semibold">{formatCurrency(cod.fee_amount)}</dd>
          </div>
        ) : null}

        <div className="flex justify-between gap-4 border-t border-border pt-3">
          <dt className="text-sm font-bold text-foreground">Total Pembayaran</dt>
          {/* Total tidak memakai warna diskon: dominansinya dari ukuran dan
              ketebalan, supaya merah tetap bermakna khusus untuk potongan. */}
          <dd className="tabular-nums text-base font-bold text-foreground">
            {formatCurrency(finalTotal)}
          </dd>
        </div>
        {discount > 0 ? (
          <p className="mt-1 text-right text-[11px] leading-4 text-sale">
            Anda menghemat {formatCurrency(savedAmount)}
          </p>
        ) : null}
      </dl>

      {/* Estimasi Tiba dipisah dari daftar rincian: ini informasi pengiriman,
          bukan komponen perhitungan, sehingga tidak memutus alur penjumlahan
          biaya. Warnanya dibedakan (biru info) dari angka rupiah. */}
      {liveEta ? (
        /* Bertumpuk, bukan sebaris: pada panel sempit label dan tanggal saling
           berdesakan sehingga labelnya terpotong di tengah frasa. */
        <div className="mt-3 rounded-md border border-info/25 bg-info/5 px-3 py-2">
          <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-info">
            <Icon name="truck" className="size-3.5 shrink-0" weight="bold" aria-hidden="true" />
            Estimasi Tiba
          </span>
          <span className="mt-0.5 block text-[11px] font-semibold text-info">
            {displayEtaRangeLabel(liveEta)}
          </span>
        </div>
      ) : null}

      <TrustAssuranceCard className="mt-2.5" />
    </aside>
  )
}
