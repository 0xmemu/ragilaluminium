import { Link } from "@inertiajs/react"
import * as React from "react"

import { MobileStickyCta } from "@/components/public/mobile-sticky-cta"
import { ShareActionButton } from "@/components/public/share-action-button"
import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { QuantityControl } from "@/components/ui/quantity-control"
import { formatCurrency } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { ProductDetailData, ProductMedia } from "@/types"

import type { ProductPurchase } from "@/hooks/use-product-purchase"

const BENEFIT_TINTS = ["bg-destructive/10", "bg-success/10", "bg-info/10"] as const

/**
 * Kolom beli di halaman detail produk: nama, rating, harga + promo, form varian,
 * CTA (desktop satu baris + sticky mobile), pengiriman, dan alasan belanja.
 * Semua state & aksi datang dari `useProductPurchase` (§5 R - page tipis, section props-only).
 */
export function ProductBuyBox({
  product,
  purchase,
  activeMedia,
  shareUrl,
}: {
  product: ProductDetailData
  purchase: ProductPurchase
  /** Media yang sedang dilihat di galeri - dipakai gambar produk "terbang" saat add-to-cart. */
  activeMedia: ProductMedia | null
  shareUrl: string
}) {
  const {
    title,
    axes,
    selections,
    variantError,
    variantSectionRef,
    selectedVariant,
    form,
    submitIntent,
    chooseAxis,
    requestVariant,
    addToCart,
    changeQuantity,
    averageRating,
    ratingLabel,
    ratedReviews,
    currentPrice,
    comparePrice,
    discountPercent,
    benefits,
    promo,
  } = purchase

  const ctaDisabled = (selectedVariant?.stock != null && selectedVariant.stock < 1) || form.processing

  // Split nama produk otomatis: baris 1 = ukuran ("Tinggi …cm × Panjang …cm"), baris 2 = model.
  const dimMatch = title.match(
    /^(Custom\s+)?(Tinggi\s+[\d.,]+\s*cm\s*[x×]\s*Panjang\s+[\d.,]+\s*cm(?:\s*\(\s*[\d.,]+\s*[x×]\s*[\d.,]+\s*\))?)\s*(.*)$/i,
  )
  const titleLine1 = dimMatch ? `${dimMatch[1] ?? ""}${dimMatch[2]}`.trim() : title
  const titleLine2 = dimMatch?.[3]?.trim() ?? ""

  // Label varian terpilih dari sumbu yang dipilih, mis. "Putih / Kaca Bening".
  const selectedVariantLabel =
    axes
      .map((axis) => selections[axis.name])
      .filter(Boolean)
      .join(" / ") || selectedVariant?.label || ""

  return (
    <>
      {/* Nama produk - baris 1 ukuran, baris 2 model (split otomatis), font body */}
      <div className="mt-0 flex items-start justify-between gap-3">
        <h1 style={{ textWrap: "wrap" }} className="min-w-0 flex-1 text-sm lg:text-[21px] font-normal tracking-tight text-foreground">
          <span className="block">
            {titleLine1}
            {titleLine2 ? ` ${titleLine2}` : ""}
          </span>
        </h1>
      </div>

      {/* Harga utama + sub-harga (coret, diskon, flash) di bawahnya */}
      <div className="mt-2">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="tabular-nums text-[20px] font-bold leading-6 text-sale">
            {currentPrice !== null
              ? `${selectedVariant ? '' : '~ '}${formatCurrency(currentPrice)}`
              : "Harga belum tersedia"}
          </span>
        </div>
        {comparePrice || promo?.flash_sale ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {comparePrice ? (
              <span className="tabular-nums text-sm font-light leading-5 text-muted-foreground line-through">
                {formatCurrency(comparePrice)}
              </span>
            ) : null}
            {discountPercent && discountPercent > 0 ? (
              <span className="rounded bg-destructive/10 px-1.5 text-xs font-semibold leading-5 text-destructive">
                -{discountPercent}%
              </span>
            ) : null}
            {promo?.flash_sale ? (
              <span className="inline-flex items-center gap-1">
                <Icon name="lightning" weight="fill" className="size-4 shrink-0 text-sale" aria-hidden />
                <span className="text-base font-extrabold italic leading-5 tracking-tight text-sale">FLASH SALE</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {averageRating !== null || (product.sold_count ?? 0) > 0 ? (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-snug text-muted-foreground">
          {(product.sold_count ?? 0) > 0 ? (
            <span>{product.sold_count} terjual</span>
          ) : null}
          {averageRating !== null ? (
            <>
              <span className="text-muted-foreground/50">·</span>
              <Icon name="star" weight="fill" className="size-3 text-warning" aria-hidden />
              <span className="tabular-nums font-medium text-foreground">
                {ratingLabel} ({ratedReviews.length} ulasan)
              </span>
            </>
          ) : null}
        </p>
      ) : null}

      <form
        onSubmit={(event) => addToCart(event, activeMedia)}
        className="mt-3 space-y-4"
      >
        <div ref={variantSectionRef} className="space-y-4">
          {axes.length > 0 || selectedVariant ? (
            <div className="mb-2 flex items-center justify-between gap-3">
              {axes.length > 0 ? (
                <p className="text-xs font-bold text-foreground">Pilih varian</p>
              ) : null}
              {selectedVariant ? (
                <p className="min-w-0 truncate text-right text-xs font-light text-muted-foreground">
                  <span>{selectedVariantLabel}</span>
                  <span className="mx-1">·</span>
                  <span
                    className={cn(
                      selectedVariant.stock > 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {selectedVariant.stock > 0 ? `Stok ${selectedVariant.stock}` : "Habis"}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}
          {axes.map((axis) => (
            <fieldset key={axis.name} className="min-w-0">
              <div className="flex min-w-0 flex-nowrap items-center gap-x-2 gap-y-1.5 overflow-x-auto">
                <legend className="text-xs font-medium text-muted-foreground shrink-0">
                  {axis.name === "Warna"
                    ? "Warna"
                    : axis.name === "Kaca"
                      ? "Kaca"
                      : axis.name}
                </legend>
                {axis.options.map((option) => (
                  <button
                    type="button"
                    key={option}
                    onClick={() => chooseAxis(axis.name, option)}
                    className={cn(
                      "min-h-8 shrink-0 rounded-full border px-2.5 text-xs font-semibold transition",
                      variantError && !selections[axis.name]
                        ? "border-destructive animate-pulse"
                        : selections[axis.name] === option
                          ? "border-foreground bg-foreground text-white"
                          : "border-border bg-surface text-foreground hover:border-foreground/40",
                    )}
                    aria-pressed={selections[axis.name] === option}
                  >
                    <span className="block max-w-full truncate">{option}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        {variantError && !selectedVariant && purchase.variants.length ? (
          <Alert className="mt-3" tone="warning" title="Pilih varian" />
        ) : null}
        {!purchase.variants.length ? (
          <Alert className="mt-3" tone="warning" title="Varian belum tersedia" />
        ) : null}

        {form.errors.variant_sku || form.errors.parent_sku || form.errors.quantity ? (
          <Alert className="mt-4" tone="danger" title="Produk belum dapat ditambahkan">
            {form.errors.variant_sku ?? form.errors.parent_sku ?? form.errors.quantity}
          </Alert>
        ) : null}

        {/* CTA - desktop / tablet satu baris horizontal: share + qty + beli sekarang + keranjang (tinggi dan alignment sejajar rapi) */}
        <div className="mt-0 hidden items-center gap-2 lg:flex">
          <ShareActionButton
            title={title}
            url={shareUrl}
            className="!size-10 !rounded-md border border-border !bg-surface !text-foreground !shadow-none hover:!bg-muted"
          />
          <QuantityControl
            className="h-10 rounded-md border border-border bg-surface px-1.5"
            compact
            value={form.data.quantity}
            onChange={(quantity) => {
              if (!selectedVariant) {
                requestVariant()
                return
              }
              form.setData("quantity", quantity)
            }}
            max={selectedVariant?.stock}
            disabled={ctaDisabled}
          />
          <Button
            type="button"
            variant="secondary"
            className="!rounded-md h-10 min-h-10 flex-1 text-xs font-semibold"
            disabled={ctaDisabled}
            onClick={purchase.buyNow}
          >
            <Icon name="credit-card" className="size-4" aria-hidden="true" />
            {form.processing && submitIntent === "checkout" ? "..." : "Beli Sekarang"}
          </Button>
          <Button
            type="submit"
            className="!rounded-md h-10 min-h-10 flex-1 text-xs font-semibold"
            disabled={ctaDisabled}
          >
            <Icon name="shopping-cart" className="size-4" aria-hidden="true" />
            {form.processing && submitIntent === "cart" ? "..." : "Keranjang"}
          </Button>
        </div>

        <MobileStickyCta
          aria-label="Beli produk"
          spacerClassName="hidden"
          hideBelowSection="#produk-terkait"
          className="!p-0 !border-t-0 shadow-[0_-4px_16px_hsl(var(--foreground)/0.08)]"
        >
          {/* Segmented full-width continuous stripe tanpa pill tombol terpisah */}
          <div className="flex w-full items-stretch h-10 divide-x divide-border overflow-hidden border-t border-border bg-surface">
            {/* Segment 1: Quantity */}
            <div className="flex shrink-0 items-center justify-center bg-surface px-1.5 text-foreground">
              <button
                type="button"
                onClick={() => {
                  if (!selectedVariant) { requestVariant(); return; }
                  changeQuantity(Math.max(1, form.data.quantity - 1))
                }}
                disabled={ctaDisabled || form.data.quantity <= 1}
                className="flex size-7 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:opacity-30 focus-visible:outline-none"
                aria-label="Kurangi jumlah"
              >
                <Icon name="minus" className="size-3" />
              </button>
              <span className="min-w-[1.25rem] text-center font-mono text-xs font-bold text-foreground">
                {form.data.quantity}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!selectedVariant) { requestVariant(); return; }
                  changeQuantity(selectedVariant?.stock ? Math.min(selectedVariant.stock, form.data.quantity + 1) : form.data.quantity + 1)
                }}
                disabled={ctaDisabled || (selectedVariant?.stock !== undefined && form.data.quantity >= selectedVariant.stock)}
                className="flex size-7 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:opacity-30 focus-visible:outline-none"
                aria-label="Tambah jumlah"
              >
                <Icon name="plus" className="size-3" />
              </button>
            </div>

            {/* Segment 2: Beli Sekarang */}
            <button
              type="button"
              disabled={ctaDisabled}
              onClick={purchase.buyNow}
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 bg-surface-muted/90 px-2 text-xs font-semibold text-foreground transition hover:bg-muted active:bg-muted/80 disabled:opacity-40 focus-visible:outline-none"
            >
              <Icon name="credit-card" className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {form.processing && submitIntent === "checkout" ? (
                  "..."
                ) : (
                  <>
                    <span className="min-[360px]:hidden">Beli</span>
                    <span className="hidden min-[360px]:inline">Beli Sekarang</span>
                  </>
                )}
              </span>
            </button>

            {/* Segment 3: Keranjang */}
            <button
              type="submit"
              disabled={ctaDisabled}
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 bg-primary px-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover active:bg-primary-hover/90 disabled:opacity-40 focus-visible:outline-none"
            >
              <Icon name="shopping-cart" className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {form.processing && submitIntent === "cart" ? "..." : "Keranjang"}
              </span>
            </button>
          </div>
        </MobileStickyCta>
      </form>

      {/* Pengiriman */}
      <div className="mt-4 border border-border p-4">
        <h2 className="text-sm font-bold text-foreground">Pengiriman</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Dikirim ke seluruh Indonesia via J&T Cargo. Ongkos kirim dihitung saat checkout
          berdasarkan alamat tujuan.{" "}
          <Link href={routeUrl("order.status")} className="font-semibold text-primary hover:underline">
            Lacak pesanan
          </Link>
        </p>
      </div>

      {/* Benefit belanja */}
      <div className="mt-4">
        <h2 className="truncate text-sm font-bold text-foreground">
          Alasan harus belanja di Ragil Aluminium
        </h2>
        <div className="mt-3 flex gap-2.5">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.label}
              className={cn(
                "relative flex min-h-[3.75rem] flex-1 min-w-0 items-center overflow-hidden px-3 py-2.5",
                BENEFIT_TINTS[index % BENEFIT_TINTS.length],
              )}
            >
              <Icon
                name={benefit.icon}
                className="mr-2 size-5 shrink-0 text-foreground/30"
                weight="fill"
                aria-hidden="true"
              />
              <p className="relative z-10 text-xs font-medium leading-tight text-foreground/80">
                {benefit.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

