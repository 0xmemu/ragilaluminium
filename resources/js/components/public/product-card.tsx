import { Link, usePage } from "@inertiajs/react"
import { Heart, Lightning, SealCheck } from "@phosphor-icons/react"
import * as React from "react"

import { ResponsiveImage } from "@/components/ui/responsive-image"
import { formatCurrency, productName } from "@/lib/format"
import { trackProductClick } from "@/lib/product-engage"
import { cn } from "@/lib/utils"
import type { ProductCardData, SharedPageProps } from "@/types"

/**
 * Baris compare-price + discount badge wajib satu baris; font menyusut
 * bila baris meluap (JS meng-override `font-size` inline).
 */
function FitOneLine({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = React.useRef<HTMLSpanElement>(null)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const fit = () => {
      el.style.fontSize = ""
      const parent = el.parentElement
      if (!parent) return
      let size = parseFloat(getComputedStyle(el).fontSize) || 11
      const min = 10.5
      while (el.scrollWidth > parent.clientWidth + 0.5 && size > min) {
        size -= 0.5
        el.style.fontSize = `${size}px`
      }
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    if (el.parentElement) observer.observe(el.parentElement)
    return () => observer.disconnect()
  }, [children])

  return (
    <span ref={ref} className={className}>
      {children}
    </span>
  )
}

function CodBadge() {
  return (
    <span className="product-card__cod">
      {/* Single composite SVG — avoid layered scale (subpixel breaks thin strokes). ~lightning height. */}
      <img
        src="/images/icons/cod.svg"
        alt=""
        width={30}
        height={15}
        className="h-[15px] w-[30px]"
        aria-hidden="true"
      />
      <span className="sr-only">COD tersedia</span>
    </span>
  )
}

/**
 * Product card — BEM visual system (Zalora-inspired guideline).
 *
 * Block: `.product-card` (+ modifier `--discounted/--flash/--unavailable/--model`)
 * Elements: `__media __link __image __badge __availability __favorite
 *           __content __title __pricing __price __empty-price __compare
 *           __original-price __discount __extras __cod __flash-label
 *           __meta __warranty __sold`
 *
 * Seluruh chrome visual hidup di `@layer components` (resources/css/app.css)
 * berbasis token :root; komponen ini hanya data-driven + state. Interaksi
 * memakai dua link terpisah (media + body) — pola multi-link standar —
 * sehingga overlay wishlist tetap sibling link (HTML valid).
 */
export function ProductCard({
  product,
  priority = false,
  className,
  emphasis = "default",
  titleStyle = "default",
  imageFit = "cover",
  isWishlisted = false,
  onWishlistChange,
}: {
  product: ProductCardData
  priority?: boolean
  className?: string
  /** Stronger Flash Sale chrome for /flash-sale and Promo spotlight. */
  emphasis?: "default" | "flash"
  /** `model` = tipografi judul ModelCard (container query, lebih rapat di carousel). */
  titleStyle?: "default" | "model"
  /** Override image crop behavior for contexts that must show the whole asset. */
  imageFit?: "cover" | "contain"
  /** State wishlist — hanya berpengaruh bila `onWishlistChange` disediakan. */
  isWishlisted?: boolean
  /** Tanpa handler, tombol wishlist tidak dirender. */
  onWishlistChange?: (next: boolean) => void
}) {
  const title = productName(product.name, product.short_name)
  const priceValue =
    product.min_price !== null && product.min_price !== undefined
      ? Number(product.min_price)
      : null
  const compareValue =
    product.compare_price !== null && product.compare_price !== undefined
      ? Number(product.compare_price)
      : null
  const hasCompare =
    priceValue !== null &&
    compareValue !== null &&
    Number.isFinite(compareValue) &&
    compareValue > priceValue
  const discountPercent =
    product.discount_percent ??
    (hasCompare && compareValue
      ? Math.round(((compareValue - (priceValue as number)) / compareValue) * 100)
      : null)
  const showFlash = product.flash_sale === true || emphasis === "flash"
  const showCod = product.cod_eligible !== false
  const warrantyLabel = product.warranty_label?.trim() || "Garansi 100%"
  const soldCount = Number(product.sold_count ?? 0)
  const flashEmphasis = emphasis === "flash"
  const useModelTitle = titleStyle === "model"
  const isAvailable = product.isAvailable !== false
  const { csrf } = usePage<SharedPageProps>().props

  const cardClass = cn(
    "product-card",
    hasCompare && "product-card--discounted",
    flashEmphasis && "product-card--flash",
    !isAvailable && "product-card--unavailable",
    useModelTitle && "product-card--model",
    className,
  )
  const linkClass = "product-card__link"

  return (
    <article className={cardClass}>
      <div className="product-card__media">
        <Link
          href={product.href}
          prefetch
          className={linkClass}
          onClick={() => trackProductClick(product.id, csrf)}
        >
          <ResponsiveImage
            src={product.image}
            alt={title}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            wrapperClassName="size-full bg-muted/50"
            className={cn(
              "product-card__image",
              imageFit === "contain" ? "!object-contain" : "object-cover",
            )}
          />
        </Link>

        {flashEmphasis ? (
          <span className="product-card__badge">
            <Lightning weight="fill" className="size-3 shrink-0" aria-hidden />
            Flash
          </span>
        ) : null}
        {!isAvailable ? (
          <span className="product-card__availability">Stok habis</span>
        ) : null}
        {onWishlistChange ? (
          <button
            type="button"
            className="product-card__favorite"
            aria-label={
              isWishlisted ? "Hapus dari wishlist" : "Tambahkan ke wishlist"
            }
            aria-pressed={isWishlisted}
            onClick={() => onWishlistChange(!isWishlisted)}
          >
            <Heart
              weight={isWishlisted ? "fill" : "regular"}
              className="size-4"
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>

      <Link
        href={product.href}
        prefetch
        className={cn(linkClass, "product-card__link--body")}
        onClick={() => trackProductClick(product.id, csrf)}
      >
        <div className="product-card__content">
          <h3 data-slot="product-item-name" className="product-card__title">
            {title}
          </h3>

          {/* Harga bertumpuk: compare + diskon wajib satu baris (mengecil bila sempit). */}
          <div className="product-card__pricing">
            {priceValue !== null && Number.isFinite(priceValue) ? (
              <>
                <span className="product-card__price">
                  {formatCurrency(priceValue)}
                </span>
                {hasCompare ? (
                  <FitOneLine className="product-card__compare">
                    <span className="product-card__original-price">
                      {formatCurrency(compareValue)}
                    </span>
                    {discountPercent !== null && discountPercent > 0 ? (
                      <span className="product-card__discount">
                        -{discountPercent}%
                      </span>
                    ) : null}
                  </FitOneLine>
                ) : null}
              </>
            ) : (
              <span className="product-card__empty-price">Lihat harga</span>
            )}
          </div>

          <div className="product-card__extras">
            {showCod ? <CodBadge /> : null}
            {showFlash ? (
              <span className="product-card__flash-label">
                <Lightning weight="fill" className="-mr-px size-3.5 shrink-0" aria-hidden />
                FLASH SALE
              </span>
            ) : null}
          </div>

          <div className="product-card__meta">
            <span className="product-card__warranty">
              <SealCheck weight="fill" className="size-3.5 shrink-0 lg:size-4" aria-hidden />
              <span className="truncate">{warrantyLabel}</span>
            </span>
            {soldCount > 0 ? (
              <span className="product-card__sold">
                {soldCount.toLocaleString("id-ID")} terjual
              </span>
            ) : (
              <span className="shrink-0" aria-hidden="true" />
            )}
          </div>
        </div>
      </Link>
    </article>
  )
}
