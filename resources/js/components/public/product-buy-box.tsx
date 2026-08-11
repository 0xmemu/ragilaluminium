import { Link } from "@inertiajs/react"

import { MobileStickyCta } from "@/components/public/mobile-sticky-cta"
import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { QuantityControl } from "@/components/ui/quantity-control"
import { formatCurrency } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { ProductDetailData, ProductMedia } from "@/types"

import type { ProductPurchase } from "@/hooks/use-product-purchase"

const BENEFIT_TINTS = ["bg-[#fdf2f2]", "bg-[#eef4ef]", "bg-[#eef2f6]"] as const

/**
 * Kolom beli di halaman detail produk: nama, rating, harga + promo, form varian,
 * CTA (desktop satu baris + sticky mobile), pengiriman, dan alasan belanja.
 * Semua state & aksi datang dari `useProductPurchase` (§5 R — page tipis, section props-only).
 */
export function ProductBuyBox({
  product,
  purchase,
  activeMedia,
}: {
  product: ProductDetailData
  purchase: ProductPurchase
  /** Media yang sedang dilihat di galeri — dipakai gambar produk "terbang" saat add-to-cart. */
  activeMedia: ProductMedia | null
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

  return (
    <>
      {/* Nama produk + varian terpilih */}
      <h1 className="text-base font-bold tracking-tight text-foreground">
        {title}
        {selectedVariant?.label ? (
          <span className="ml-1.5 text-sm font-normal text-muted-foreground">
            {selectedVariant.label}
          </span>
        ) : null}
      </h1>

      {/* Model produk + rating — satu baris */}
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <Link
          href={product.model_href ?? routeUrl("catalog.index")}
          className="inline-block break-words text-xs leading-snug text-muted-foreground hover:text-primary"
        >
          {product.subtitle}
        </Link>
        {averageRating !== null ? (
          <div className="inline-flex shrink-0 items-center gap-0.5 text-xs">
            <span className="font-semibold text-foreground">{ratingLabel}</span>
            <Icon name="star" weight="fill" className="size-3 text-warning" aria-hidden />
            <span className="text-muted-foreground">{ratedReviews.length} ulasan</span>
          </div>
        ) : null}
      </div>

      {/* Harga + promo */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="tabular-nums text-2xl font-bold leading-8 text-sale">
          {currentPrice !== null
            ? `${selectedVariant ? '' : '~ '}${formatCurrency(currentPrice)}`
            : "Harga belum tersedia"}
        </span>
        {comparePrice ? (
          <>
            <span className="tabular-nums text-sm font-light leading-5 text-muted-foreground line-through">
              {formatCurrency(comparePrice)}
            </span>
            {discountPercent && discountPercent > 0 ? (
              <span className="rounded bg-[#fdf2f2] px-1.5 text-xs font-semibold leading-5 text-[#c81e1e]">
                -{discountPercent}%
              </span>
            ) : null}
          </>
        ) : null}
        {promo?.flash_sale ? (
          <span className="inline-flex items-center gap-1">
            <Icon name="lightning" weight="fill" className="size-4 shrink-0 text-sale" aria-hidden />
            <span className="text-base font-extrabold italic leading-5 tracking-tight text-sale">FLASH SALE</span>
          </span>
        ) : null}
      </div>

      <form
        onSubmit={(event) => addToCart(event, activeMedia)}
        className="mt-3 space-y-4"
      >
        <div ref={variantSectionRef} className="space-y-4">
          {axes.length > 0 ? (
            <p className="mb-2 text-xs text-muted-foreground">Pilih varian</p>
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
                      "min-h-11 shrink-0 rounded-full border px-3 text-xs font-semibold transition sm:min-h-8",
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

        {selectedVariant ? (
          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 truncate text-muted-foreground">
              {selectedVariant.dimension_label ?? selectedVariant.label}
            </span>
            <span
              className={cn(
                "shrink-0 font-semibold",
                selectedVariant.stock > 0 ? "text-success" : "text-destructive",
              )}
            >
              {selectedVariant.stock > 0 ? `Stok ${selectedVariant.stock}` : "Habis"}
            </span>
          </div>
        ) : purchase.variants.length ? (
          <Alert className="mt-3" tone="warning" title="Pilih varian" />
        ) : (
          <Alert className="mt-3" tone="warning" title="Varian belum tersedia" />
        )}

        {form.errors.variant_sku || form.errors.parent_sku || form.errors.quantity ? (
          <Alert className="mt-4" tone="danger" title="Produk belum dapat ditambahkan">
            {form.errors.variant_sku ?? form.errors.parent_sku ?? form.errors.quantity}
          </Alert>
        ) : null}

        {/* CTA — desktop / tablet satu baris horizontal: qty + keranjang + beli sekarang */}
        <div className="mt-0 hidden gap-2 lg:flex">
          <QuantityControl
            className="h-10"
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
            size="md"
            className="h-11 flex-1 text-sm"
            disabled={ctaDisabled}
            onClick={purchase.buyNow}
          >
            <Icon name="credit-card" className="size-4" aria-hidden="true" />
            {form.processing && submitIntent === "checkout" ? "..." : "Beli Sekarang"}
          </Button>
          <Button
            type="submit"
            size="md"
            className="h-11 flex-1 text-sm"
            disabled={ctaDisabled}
          >
            <Icon name="shopping-cart" className="size-4" aria-hidden="true" />
            {form.processing && submitIntent === "cart" ? "..." : "Keranjang"}
          </Button>
        </div>

        <MobileStickyCta
          aria-label="Beli produk"
          spacerClassName="hidden"
          className="[&>div]:flex-row [&>div]:gap-2"
        >
          <QuantityControl
            className="h-10"
            value={form.data.quantity}
            onChange={(quantity) => {
              if (!selectedVariant) {
                requestVariant()
                return
              }
              changeQuantity(quantity)
            }}
            max={selectedVariant?.stock}
            disabled={ctaDisabled}
          />
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="h-11 min-h-11 flex-1 text-xs"
            disabled={ctaDisabled}
            onClick={purchase.buyNow}
          >
            <Icon name="credit-card" className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {form.processing && submitIntent === "checkout" ? "..." : "Beli Sekarang"}
            </span>
          </Button>
          <Button
            type="submit"
            size="md"
            className="h-11 min-h-11 flex-1 text-xs"
            disabled={ctaDisabled}
          >
            <Icon name="shopping-cart" className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {form.processing && submitIntent === "cart" ? "..." : "Keranjang"}
            </span>
          </Button>
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
          Alasan belanja di Ragil Aluminium
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

