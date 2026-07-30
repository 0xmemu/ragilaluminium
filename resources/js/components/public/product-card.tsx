import { Link, usePage } from "@inertiajs/react"
import { Lightning, SealCheck } from "@phosphor-icons/react"

import { ResponsiveImage } from "@/components/ui/responsive-image"
import { formatCurrency, productName } from "@/lib/format"
import { trackProductClick } from "@/lib/product-engage"
import { cn } from "@/lib/utils"
import type { ProductCardData, SharedPageProps } from "@/types"

export function ProductCard({
  product,
  priority = false,
  className,
  emphasis = "default",
  titleStyle = "default",
}: {
  product: ProductCardData
  priority?: boolean
  className?: string
  /** Stronger Flash Sale chrome for /flash-sale and Promo spotlight. */
  emphasis?: "default" | "flash"
  /** `model` = tipografi judul ModelCard (container query, lebih rapat di carousel). */
  titleStyle?: "default" | "model"
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
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
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
          <h3
            className={cn(
              "line-clamp-2 min-w-0 font-medium text-foreground",
              useModelTitle
                ? "text-xs leading-4 @[16rem]:text-[13px] @[16rem]:leading-4 @[22rem]:text-sm @[22rem]:leading-5"
                : "text-sm leading-5 group-hover:underline",
            )}
          >
            {title}
          </h3>

          {/* Harga bertumpuk: antisipasi angka panjang agar tidak wrap acak */}
          <div className="mt-1 flex min-h-6 flex-col">
            {priceValue !== null && Number.isFinite(priceValue) ? (
              <>
                <span className="tabular-nums text-base font-bold leading-6 text-sale lg:text-xl lg:leading-7">
                  {formatCurrency(priceValue)}
                </span>
                {hasCompare ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="tabular-nums text-sm font-light leading-5 text-muted-foreground line-through lg:text-base lg:leading-6">
                      {formatCurrency(compareValue)}
                    </span>
                    {discountPercent !== null && discountPercent > 0 ? (
                      <span className="bg-accent px-1.5 text-xs font-semibold leading-5 text-accent-foreground lg:text-sm lg:leading-6">
                        -{discountPercent}%
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-sm font-medium text-muted-foreground lg:text-base">Lihat harga</span>
            )}
          </div>

          <div className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5">
            {showCod ? (
              <span
                className="relative inline-flex h-[17px] w-[34px] shrink-0"
                aria-label="COD tersedia"
              >
                <img
                  src="/images/icons/cod-card-layer.svg"
                  alt=""
                  className="absolute h-[16.2812px] w-[33.8542px]"
                  style={{ left: 0.135437, top: 0 }}
                  aria-hidden="true"
                />
                <img
                  src="/images/icons/cod-part2.svg"
                  alt=""
                  className="absolute h-[5.11458px] w-[4.5625px]"
                  style={{ left: 16.4167, top: 5.5625 }}
                  aria-hidden="true"
                />
                <img
                  src="/images/icons/cod-part3.svg"
                  alt=""
                  className="absolute h-[4.9375px] w-[3.54167px]"
                  style={{ left: 25.8125, top: 5.64587 }}
                  aria-hidden="true"
                />
                <img
                  src="/images/icons/cod-p4.svg"
                  alt=""
                  className="absolute h-px w-[6.75px]"
                  style={{ left: 0, top: 10.073 }}
                  aria-hidden="true"
                />
                <img
                  src="/images/icons/cod-p5.svg"
                  alt=""
                  className="absolute h-px w-[6.73958px]"
                  style={{ left: 0.833313, top: 11.625 }}
                  aria-hidden="true"
                />
                <span className="sr-only">COD tersedia</span>
              </span>
            ) : null}
            {showFlash ? (
              <span className="inline-flex shrink-0 items-center">
                <Lightning weight="fill" className="-mr-px size-3.5 shrink-0 text-sale lg:size-4" aria-hidden />
                <span className="whitespace-nowrap text-[11px] font-extrabold italic leading-4 tracking-tight text-sale sm:text-sm lg:text-base lg:leading-5">
                  FLASH SALE
                </span>
              </span>
            ) : null}
          </div>

          <div className="mt-auto flex items-end justify-between gap-2 pt-1">
            <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-medium leading-4 text-warning lg:text-xs lg:leading-5">
              <SealCheck weight="fill" className="size-3.5 shrink-0 lg:size-4" aria-hidden />
              <span className="truncate">{warrantyLabel}</span>
            </span>
            {soldCount > 0 ? (
              <span className="shrink-0 text-[10px] font-light leading-4 text-muted-foreground lg:text-xs lg:leading-5">
                {soldCount.toLocaleString("id-ID")} terjual
              </span>
            ) : (
              <span className="shrink-0" aria-hidden="true" />
            )}
          </div>
        </div>
      </Link>
      {product.installation_href ? (
        <Link
          href={product.installation_href}
          className="mx-2 mb-2 inline-flex min-h-8 items-center text-[11px] font-semibold text-primary hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          Hasil pemasangan
        </Link>
      ) : null}
    </article>
  )
}
