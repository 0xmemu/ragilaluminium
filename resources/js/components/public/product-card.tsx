import { Link, usePage } from "@inertiajs/react"
import { Lightning, SealCheck } from "@phosphor-icons/react"
import * as React from "react"

import { ResponsiveImage } from "@/components/ui/responsive-image"
import { formatCurrency, productName } from "@/lib/format"
import { trackProductClick } from "@/lib/product-engage"
import { cn } from "@/lib/utils"
import type { ProductCardData, SharedPageProps } from "@/types"

/** Shrink title font so up to 2 lines fill the card width (hindari orphan kata di baris 2). */
function FitTwoLineTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = React.useRef<HTMLHeadingElement>(null)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const fit = () => {
      el.style.fontSize = ""
      const base = parseFloat(getComputedStyle(el).fontSize) || 13
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || base * 1.25
      const maxHeight = lineHeight * 2 + 0.5
      let size = base
      const min = Math.max(10, base - 3)
      while (el.scrollHeight > maxHeight + 0.5 && size > min) {
        size -= 0.5
        el.style.fontSize = `${size}px`
      }
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [children])

  return (
    <h3 ref={ref} className={className}>
      {children}
    </h3>
  )
}

/** Keep compare-price + discount badge on one line; shrink font when the row overflows. */
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
      const min = 8
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
    <span
      ref={ref}
      className={cn(
        "inline-flex max-w-full flex-nowrap items-center gap-1 whitespace-nowrap text-[13px] leading-4 sm:text-sm sm:leading-4",
        className,
      )}
    >
      {children}
    </span>
  )
}

function CodBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center", className)} aria-label="COD tersedia">
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

export function ProductCard({
  product,
  priority = false,
  className,
  emphasis = "default",
  titleStyle = "default",
  imageFit = "cover",
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
  const { csrf } = usePage<SharedPageProps>().props

  return (
    <article
      className={cn(
        "group flex h-full min-w-0 flex-col overflow-hidden border border-transparent bg-white shadow-[0_1px_3px_rgba(10,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-foreground/25 hover:shadow-[0_10px_24px_rgba(10,0,0,0.14)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        useModelTitle && "@container",
        flashEmphasis && "ring-1 ring-primary/25 shadow-[0_2px_8px_rgba(192,0,0,0.12)]",
        className,
      )}
    >
      <Link
        href={product.href}
        prefetch
        className="flex min-w-0 flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => trackProductClick(product.id, csrf)}
      >
        <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-muted/50">
          <ResponsiveImage
            src={product.image}
            alt={title}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            wrapperClassName="aspect-square size-full bg-muted/50"
            className={cn(
              imageFit === "contain" ? "!object-contain" : "object-cover",
              "transition duration-300 group-hover:scale-[1.03]",
            )}
          />
          {flashEmphasis ? (
            <span className="absolute left-0 top-0 z-10 inline-flex items-center gap-0.5 bg-primary px-2 py-1 text-[10px] font-extrabold uppercase italic leading-none tracking-tight text-primary-foreground sm:text-[11px]">
              <Lightning weight="fill" className="size-3 shrink-0" aria-hidden />
              Flash
            </span>
          ) : null}
        </div>

        <div
          className={cn(
            "relative flex flex-1 flex-col gap-0",
            useModelTitle ? "px-2.5 pb-2 pt-2 @[16rem]:px-3 @[20rem]:px-3.5" : "px-2 pb-2 pt-2",
          )}
        >
          <FitTwoLineTitle className="w-full min-w-0 font-medium text-foreground text-pretty line-clamp-2 text-xs leading-4 sm:text-[13px] sm:leading-4">
            {title}
          </FitTwoLineTitle>

          {/* Harga bertumpuk: compare + diskon wajib satu baris (mengecil bila sempit). */}
          <div className="mt-0.5 flex min-w-0 flex-col leading-none">
            {priceValue !== null && Number.isFinite(priceValue) ? (
              <>
                <span className="tabular-nums text-base font-bold leading-5 text-sale lg:text-xl lg:leading-6">
                  {formatCurrency(priceValue)}
                </span>
                {hasCompare ? (
                  <div className="mt-0.5 min-w-0 max-w-full overflow-hidden">
                    <FitOneLine>
                      <span className="tabular-nums font-light text-muted-foreground line-through">
                        {formatCurrency(compareValue)}
                      </span>
                      {discountPercent !== null && discountPercent > 0 ? (
                        <span className="shrink-0 bg-accent px-1 text-[11px] font-normal leading-4 text-accent-foreground sm:text-xs">
                          -{discountPercent}%
                        </span>
                      ) : null}
                    </FitOneLine>
                  </div>
                ) : null}
              </>
            ) : (
              <span className="text-sm font-medium leading-5 text-muted-foreground lg:text-base">Lihat harga</span>
            )}
          </div>

          <div className="mt-1 flex min-h-4 flex-wrap items-center gap-1.5">
            {showCod ? <CodBadge /> : null}
            {showFlash ? (
              <span className="inline-flex shrink-0 items-center">
                <Lightning weight="fill" className="-mr-px size-3.5 shrink-0 text-sale" aria-hidden />
                <span className="whitespace-nowrap text-[11px] font-extrabold italic leading-none tracking-tight text-sale sm:text-sm">
                  FLASH SALE
                </span>
              </span>
            ) : null}
          </div>

          <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
            <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-medium leading-none text-warning lg:text-xs">
              <SealCheck weight="fill" className="size-3.5 shrink-0 lg:size-4" aria-hidden />
              <span className="truncate">{warrantyLabel}</span>
            </span>
            {soldCount > 0 ? (
              <span className="shrink-0 text-[10px] font-light leading-none text-muted-foreground lg:text-xs">
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
