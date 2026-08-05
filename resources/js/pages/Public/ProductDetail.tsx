import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { GalleryLightbox } from "@/components/public/gallery-lightbox"
import { ProductCard } from "@/components/public/product-card"
import { MobileStickyCta } from "@/components/public/mobile-sticky-cta"
import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/ui/alert"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { QuantityControl } from "@/components/ui/quantity-control"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { useDragScroll } from "@/hooks/use-drag-scroll"
import PublicLayout from "@/layouts/public-layout"
import { formatCurrency, humanize, productName } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  firstAvailableSelections,
  resolveVariant,
  variantAxes,
  variantPairs,
  type VariantSelections,
} from "@/lib/variants"
import { routeUrl } from "@/lib/routes"
import type {
  ProductAttribute,
  ProductCardData,
  ProductDetailData,
  ProductMedia,
  ProductPromoMetadata,
  ProductVariant,
  Testimonial,
} from "@/types"

interface ProductDetailProps {
  product: ProductDetailData
  attributes: ProductAttribute[]
  variants: ProductVariant[]
  media: ProductMedia[]
  installationMedia?: Array<{ id: number; url: string; thumb?: string | null }>
  reviews: Testimonial[]
  relatedProducts: ProductCardData[]
  promo?: ProductPromoMetadata | null
}

function StarRow({
  value,
  size = "size-4",
  className,
}: {
  value: number
  size?: string
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-warning", className)} aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <Icon
          key={index}
          name="star"
          weight={index < Math.round(value) ? "fill" : "regular"}
          className={size}
        />
      ))}
    </span>
  )
}

/* ── Carousel helpers (same as Home / Paling Banyak Dipesan) ── */

const carouselNavBtnClass =
  "absolute top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white shadow-sm transition hover:scale-105 hover:bg-black/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 md:flex md:size-12"

const carouselTrackClass =
  "scrollbar-x flex min-w-0 snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain pb-3.5 md:pb-1 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y] [scroll-behavior:auto] data-[dragging=true]:snap-none data-[dragging=true]:cursor-grabbing"

const carouselCardClass =
  "w-[calc((100%-1rem)*6/13)] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/3.5)] md:w-[calc((100%-1.5rem)/4)] xl:w-[calc((100%-2rem)/5)]"

function CarouselNavButton({
  trackId,
  side,
  label,
  enabled,
  onClick,
}: {
  trackId: string
  side: "left" | "right"
  label: string
  enabled: boolean
  onClick: () => void
}) {
  if (!enabled) return null
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-controls={trackId}
      className={cn(
        carouselNavBtnClass,
        side === "left" ? "left-2 md:-left-5" : "right-2 md:-right-5",
      )}
    >
      <Icon
        name={side === "left" ? "caret-left" : "caret-right"}
        className="size-5 md:size-6"
        weight="bold"
        aria-hidden="true"
      />
    </button>
  )
}

function MobileSeeMoreSlide({ href }: { href: string }) {
  return (
    <div className="flex w-[4.75rem] shrink-0 snap-end items-center justify-center self-stretch px-0.5 md:hidden sm:w-20">
      <Link
        href={href}
        className="inline-flex flex-col items-center justify-center gap-1 text-foreground transition hover:text-primary active:scale-95"
        aria-label="Lihat selengkapnya"
      >
        <span className="inline-flex size-11 items-center justify-center rounded-full border border-foreground/25 bg-white text-foreground shadow-sm transition hover:border-foreground/40 sm:size-12">
          <Icon name="caret-right" className="size-5 sm:size-6" weight="bold" aria-hidden="true" />
        </span>
        <span className="max-w-full text-center text-[10px] font-semibold leading-tight tracking-tight sm:text-xs">
          selengkapnya
        </span>
      </Link>
    </div>
  )
}

function useHorizontalCarousel(itemCount: number) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const trackId = React.useId()
  const [canGoBack, setCanGoBack] = React.useState(false)
  const [canGoNext, setCanGoNext] = React.useState(itemCount > 4)

  useDragScroll(trackRef)

  const updateControls = React.useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const overflow = track.scrollWidth > track.clientWidth + 2
    setCanGoBack(overflow && track.scrollLeft > 2)
    setCanGoNext(overflow && track.scrollLeft + track.clientWidth < track.scrollWidth - 2)
  }, [])

  React.useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const frame = window.requestAnimationFrame(() => updateControls())
    track.addEventListener("scroll", updateControls, { passive: true })
    window.addEventListener("resize", updateControls)
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateControls()) : null
    observer?.observe(track)
    return () => {
      window.cancelAnimationFrame(frame)
      track.removeEventListener("scroll", updateControls)
      window.removeEventListener("resize", updateControls)
      observer?.disconnect()
    }
  }, [itemCount, updateControls])

  function move(direction: -1 | 1) {
    const track = trackRef.current
    if (!track) return
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    track.scrollBy({
      left: direction * track.clientWidth * 0.85,
      behavior: reduceMotion ? "auto" : "smooth",
    })
  }

  return { trackRef, trackId, canGoBack, canGoNext, move }
}

function RelatedCarousel({ products }: { products: ProductCardData[] }) {
  const items = products.slice(0, 10)
  const { trackRef, trackId, canGoBack, canGoNext, move } = useHorizontalCarousel(items.length)

  return (
    <div className="relative min-w-0 mt-5 px-1">
      <div ref={trackRef} id={trackId} className={carouselTrackClass}>
        {items.map((product, index) => (
          <div key={product.id} className={carouselCardClass}>
            <ProductCard product={product} priority={index < 4} titleStyle="model" imageFit="contain" />
          </div>
        ))}
        {items.length > 0 ? <MobileSeeMoreSlide href={routeUrl("catalog.index")} /> : null}
      </div>
      <CarouselNavButton
        trackId={trackId}
        side="left"
        label="Lihat produk sebelumnya"
        enabled={canGoBack}
        onClick={() => move(-1)}
      />
      <CarouselNavButton
        trackId={trackId}
        side="right"
        label="Lihat produk berikutnya"
        enabled={canGoNext}
        onClick={() => move(1)}
      />
    </div>
  )
}

function AccordionSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  const contentId = React.useId()

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-14 w-full items-center justify-between gap-4 text-left"
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span className="text-sm font-bold text-foreground">{title}</span>
        <Icon
          name="caret-down"
          className={cn("size-5 shrink-0 transition-transform", open && "rotate-180")}
          weight="bold"
          aria-hidden="true"
        />
      </button>
      <div id={contentId} className={cn("pb-5", !open && "hidden")}>
        {children}
      </div>
    </div>
  )
}

const BENEFIT_TINTS = ["bg-[#fdf2f2]", "bg-[#eef4ef]", "bg-[#eef2f6]"] as const

export default function ProductDetail({
  product,
  attributes = [],
  variants = [],
  media = [],
  installationMedia = [],
  reviews = [],
  relatedProducts = [],
  promo = null,
}: ProductDetailProps) {
  const title = productName(product.name, product.short_name)
  const axes = React.useMemo(
    () => variantAxes(variants).filter((axis) => axis.name !== "Ukuran"),
    [variants],
  )
  const initialSelections = React.useMemo(
    () => firstAvailableSelections(variants),
    [variants],
  )
  const [selections, setSelections] = React.useState<VariantSelections>(initialSelections)
  const [variantError, setVariantError] = React.useState(false)
  const variantSectionRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setSelections(initialSelections)
  }, [initialSelections])

  const selectedVariant = React.useMemo(
    () =>
      resolveVariant(variants, selections) ??
      (axes.length === 0 ? variants[0] ?? null : null),
    [axes.length, selections, variants],
  )

  const variantMedia = React.useMemo(() => {
    // Kumpulkan seluruh variant id yang cocok dengan pilihan saat ini (parsial pun oke)
    const filledSelections = Object.entries(selections).filter(
      ([, v]) => v !== undefined && v !== '',
    )

    if (filledSelections.length === 0) return media

    const matchingVariantIds = new Set<number>()
    variants.forEach((v) => {
      const pairs = new Map(variantPairs(v))
      const match = filledSelections.every(([axisName, axisOption]) => {
        const pairOption = pairs.get(axisName)
        // Cocokkan juga dimensi
        if (axisName === 'Ukuran') {
          return (v.dimension_label ?? v.dimension_compact) === axisOption
        }
        return pairOption === axisOption
      })
      if (match) matchingVariantIds.add(v.id)
    })

    if (matchingVariantIds.size === 0) return media

    const dedicated = media.filter((item) => {
      const vid = Number(item.product_variant_id)
      return vid && matchingVariantIds.has(vid)
    })
    if (dedicated.length) return dedicated

    const productLevel = media.filter((item) => item.product_variant_id == null)
    return productLevel
  }, [media, selectedVariant, selections, variants])
  const [activeMediaIndex, setActiveMediaIndex] = React.useState(0)
  const [lightboxIndex, setLightboxIndex] = React.useState(-1)

  const lightboxItems = React.useMemo(
    () =>
      variantMedia
        .filter((item) => Boolean(item.url))
        .map((item) => ({ src: item.url!, alt: `${title}, foto ${item.id}` })),
    [variantMedia, title],
  )

  // Swipe galeri — pakai touch events native + drag real-time
  const [galleryDrag, setGalleryDrag] = React.useState(0)
  const [galleryDragging, setGalleryDragging] = React.useState(false)
  const galleryStartX = React.useRef(0)
  const galleryWidth = React.useRef(0)
  const galleryRef = React.useRef<HTMLDivElement>(null)
  const didSwipe = React.useRef(false)

  function onGalleryTouchStart(event: React.TouchEvent) {
    if (variantMedia.length <= 1) return
    const t = event.touches[0]
    galleryStartX.current = t.clientX
    galleryWidth.current = galleryRef.current?.clientWidth ?? 0
    didSwipe.current = false
    setGalleryDragging(true)
    setGalleryDrag(0)
  }

  function onGalleryTouchMove(event: React.TouchEvent) {
    if (!galleryDragging) return
    const dx = event.touches[0].clientX - galleryStartX.current
    if (Math.abs(dx) > 8) didSwipe.current = true
    setGalleryDrag(dx)
  }

  function onGalleryTouchEnd() {
    if (!galleryDragging) return
    setGalleryDragging(false)
    const threshold = galleryWidth.current * 0.2
    if (Math.abs(galleryDrag) > threshold) {
      moveGallery(galleryDrag < 0 ? 1 : -1)
    }
    setGalleryDrag(0)
  }

  React.useEffect(() => {
    setActiveMediaIndex(0)
  }, [selectedVariant?.id])

  React.useEffect(() => {
    if (activeMediaIndex >= variantMedia.length) {
      setActiveMediaIndex(Math.max(0, variantMedia.length - 1))
    }
  }, [activeMediaIndex, variantMedia.length])

  const activeMedia = variantMedia[activeMediaIndex] ?? variantMedia[0] ?? null

  function moveGallery(direction: -1 | 1) {
    setActiveMediaIndex((current) => {
      const next = current + direction
      return Math.min(Math.max(next, 0), variantMedia.length - 1)
    })
  }

  const form = useForm({
    parent_sku: product.parent_sku,
    variant_sku: selectedVariant?.variant_sku ?? "",
    quantity: 1,
  })
  const [submitIntent, setSubmitIntent] = React.useState<"cart" | "checkout" | null>(null)

  React.useEffect(() => {
    form.setData("variant_sku", selectedVariant?.variant_sku ?? "")
    form.setData("quantity", 1)
    form.clearErrors()
  }, [selectedVariant?.variant_sku])

  function chooseAxis(axisName: string, option: string) {
    setVariantError(false)
    const nextSelections = { ...selections, [axisName]: option }
    const nextVariant = resolveVariant(variants, nextSelections)

    setSelections(nextSelections)
    form.setData("variant_sku", nextVariant?.variant_sku ?? "")
    form.setData("quantity", 1)
    form.clearErrors()

    if (nextVariant && typeof window !== "undefined") {
      const url = new URL(window.location.href)
      url.searchParams.set("variant", nextVariant.variant_sku)
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search + url.hash,
      )
    }
  }

  function addToCart(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedVariant) {
      setVariantError(true)
      variantSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    if (selectedVariant.stock < 1) return

    setSubmitIntent("cart")
    form.post(routeUrl("cart.add"), {
      preserveScroll: true,
      onSuccess: () => form.setData("quantity", 1),
      onFinish: () => setSubmitIntent(null),
    })
  }

  function buyNow() {
    if (!selectedVariant) {
      setVariantError(true)
      variantSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    if (selectedVariant.stock < 1) return

    setSubmitIntent("checkout")
    form.post(routeUrl("cart.add"), {
      onSuccess: () => router.visit(routeUrl("checkout.index")),
      onFinish: () => setSubmitIntent(null),
    })
  }

  const ratedReviews = reviews.filter((review) => (review.rating ?? 0) > 0)
  const averageRating = ratedReviews.length
    ? ratedReviews.reduce((total, review) => total + (review.rating ?? 0), 0) / ratedReviews.length
    : null
  const ratingLabel = averageRating !== null
    ? (Math.round(averageRating * 10) / 10).toLocaleString("id-ID")
    : null

  const currentPrice = selectedVariant?.price ?? promo?.min_price ?? null
  const comparePrice = promo?.compare_price ?? null
  const discountPercent = promo?.discount_percent ?? null

  const benefits = [
    { icon: "shield-check", label: promo?.warranty_label || "Garansi 100%" },
    ...(promo?.cod_eligible === false ? [] : [{ icon: "hand-coins", label: "Bayar di tempat (COD)" }]),
    { icon: "truck", label: "Kirim ke seluruh Indonesia" },
  ].slice(0, 3)

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    sku: product.parent_sku,
    description: product.description ?? product.subtitle,
    image: media.map((item) => item.url).filter(Boolean),
    offers: selectedVariant
      ? {
          "@type": "Offer",
          priceCurrency: "IDR",
          price: selectedVariant.price,
          availability:
            selectedVariant.stock > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
        }
      : undefined,
  }

  return (
    <PublicLayout>
      <Head title={title}>
        <meta
          name="description"
          content={(product.description ?? product.subtitle ?? title).slice(0, 155)}
        />
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden py-4 sm:block">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              ...(product.model_href && product.model_label
                ? [{ label: product.model_label, href: product.model_href }]
                : []),
              { label: title, href: null },
            ]}
          />
        </div>
      </section>

      <section className="container-page pb-5 pt-5 lg:pb-8 sm:pt-0">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)] lg:items-start lg:gap-10">
          <div className="group/gallery min-w-0" aria-label="Galeri produk">
            {activeMedia ? (
              <>
                <div
                  ref={galleryRef}
                  onTouchStart={onGalleryTouchStart}
                  onTouchMove={onGalleryTouchMove}
                  onTouchEnd={onGalleryTouchEnd}
                  onTouchCancel={onGalleryTouchEnd}
                  className="relative mx-auto aspect-square w-full overflow-hidden bg-white"
                >
                  <button
                    type="button"
                    onClick={() => window.history.back()}
                    className="absolute left-3 top-3 z-20 flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:hidden"
                    aria-label="Kembali"
                  >
                    <Icon name="caret-left" className="size-5" aria-hidden="true" />
                  </button>

                  {/* Horizontal strip: semua gambar sejajar — swipe real-time */}
                  <div
                    className="flex h-full touch-pan-y"
                    onClick={(event) => {
                      if (!didSwipe.current && event.target === event.currentTarget) setLightboxIndex(activeMediaIndex)
                    }}
                    style={{
                      transform: `translateX(${-activeMediaIndex * 100 + (galleryWidth.current ? (galleryDrag / galleryWidth.current) * 100 : 0)}%)`,
                      transition: galleryDragging ? 'none' : 'transform 320ms cubic-bezier(0.22,1,0.36,1)',
                    }}
                  >
                    {variantMedia.map((item, index) => (
                      <div key={item.id} className="flex h-full w-full shrink-0 items-center justify-center bg-white">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            if (!didSwipe.current) setLightboxIndex(index)
                          }}
                          className="relative size-full select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                          aria-label={`Perbesar foto produk ${index + 1}`}
                        >
                          <ResponsiveImage
                            src={item.url}
                            alt={`${title}, foto ${index + 1}`}
                            loading={index === 0 ? "eager" : "lazy"}
                            fetchPriority={index === 0 ? "high" : undefined}
                            wrapperClassName="size-full bg-white"
                            className="!object-contain"
                          />
                        </button>
                      </div>
                    ))}
                  </div>

                  {variantMedia.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => moveGallery(-1)}
                        disabled={activeMediaIndex === 0}
                        aria-label="Lihat foto sebelumnya"
                        className="absolute left-2 top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#525252] text-white opacity-100 shadow-md transition-[opacity,background-color] hover:bg-[#303030] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed md:-left-14 md:flex md:size-12 md:opacity-0 md:group-hover/gallery:opacity-100 md:group-focus-within/gallery:opacity-100 md:group-hover/gallery:disabled:opacity-35 md:group-focus-within/gallery:disabled:opacity-35"
                      >
                        <Icon name="caret-left" className="size-6" weight="bold" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveGallery(1)}
                        disabled={activeMediaIndex === variantMedia.length - 1}
                        aria-label="Lihat foto berikutnya"
                        className="absolute right-2 top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#525252] text-white opacity-100 shadow-md transition-[opacity,background-color] hover:bg-[#303030] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed md:-right-14 md:flex md:size-12 md:opacity-0 md:group-hover/gallery:opacity-100 md:group-focus-within/gallery:opacity-100 md:group-hover/gallery:disabled:opacity-35 md:group-focus-within/gallery:disabled:opacity-35"
                      >
                        <Icon name="caret-right" className="size-6" weight="bold" aria-hidden="true" />
                      </button>
                    </>
                  ) : null}
                </div>

                {variantMedia.length > 1 ? (
                  <div
                    className="scrollbar-x mt-2 flex snap-x gap-2 overflow-x-auto px-0 pb-2 sm:mt-3 sm:justify-center"
                    aria-label="Pilih foto produk"
                  >
                    {variantMedia.map((item, index) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setActiveMediaIndex(index)}
                        aria-label={`Tampilkan foto ${index + 1}`}
                        aria-current={activeMediaIndex === index ? "true" : undefined}
                        className={cn(
                          "relative size-14 shrink-0 snap-start overflow-hidden border-2 bg-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:size-16",
                          activeMediaIndex === index
                            ? "border-foreground"
                            : "border-transparent hover:border-border",
                        )}
                      >
                        <ResponsiveImage
                          src={item.thumb ?? item.url}
                          alt=""
                          wrapperClassName="size-full bg-white"
                          className="object-contain"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}

                <p className="sr-only" aria-live="polite">
                  Foto {activeMediaIndex + 1} dari {variantMedia.length}
                </p>
              </>
            ) : (
              <EmptyState
                icon="image"
                title="Foto belum tersedia"
                description="Foto produk akan tampil setelah media selesai diunggah."
              />
            )}
          </div>

          {lightboxItems.length ? (
            <GalleryLightbox
              items={lightboxItems}
              index={lightboxIndex}
              onOpenChange={(open) => { if (!open) setLightboxIndex(-1) }}
              onIndexChange={setLightboxIndex}
            />
          ) : null}

          <div className="min-w-0 lg:sticky lg:top-28">
            {/* Nama produk + varian terpilih */}
            <h1 className="text-lg font-bold leading-snug tracking-tight text-foreground">
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
                <div className="inline-flex shrink-0 items-center gap-0.5 text-[11px]">
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

            <form onSubmit={addToCart} className="mt-3 space-y-4">
              <div ref={variantSectionRef} className="space-y-4">
                {axes.length > 0 ? (
                  <p className="mb-2 text-xs text-muted-foreground">Pilih varian</p>
                ) : null}
                {axes.map((axis) => (
                <fieldset key={axis.name} className="min-w-0">
                  <div className="flex min-w-0 flex-nowrap items-center gap-x-2 gap-y-1.5 overflow-x-auto">
                    <legend className="text-[10px] font-medium text-muted-foreground shrink-0">
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
                          "min-h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition",
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
              ) : variants.length ? (
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
                      setVariantError(true)
                      variantSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
                      return
                    }
                    form.setData("quantity", quantity)
                  }}
                  max={selectedVariant?.stock}
                  disabled={selectedVariant?.stock != null && selectedVariant.stock < 1 || form.processing}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className="h-10 flex-1 text-sm"
                  disabled={selectedVariant?.stock != null && selectedVariant.stock < 1 || form.processing}
                  onClick={buyNow}
                >
                  <Icon name="credit-card" className="size-4" aria-hidden="true" />
                  {form.processing && submitIntent === "checkout" ? "..." : "Beli Sekarang"}
                </Button>
                <Button
                  type="submit"
                  size="md"
                  className="h-10 flex-1 text-sm"
                  disabled={selectedVariant?.stock != null && selectedVariant.stock < 1 || form.processing}
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
                      setVariantError(true)
                      variantSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
                      return
                    }
                    form.setData("quantity", quantity)
                  }}
                  max={selectedVariant?.stock}
                  disabled={selectedVariant?.stock != null && selectedVariant.stock < 1 || form.processing}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className="h-10 min-h-10 flex-1 text-xs"
                  disabled={selectedVariant?.stock != null && selectedVariant.stock < 1 || form.processing}
                  onClick={buyNow}
                >
                  <Icon name="credit-card" className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {form.processing && submitIntent === "checkout" ? "..." : "Beli Sekarang"}
                  </span>
                </Button>
                <Button
                  type="submit"
                  size="md"
                  className="h-10 min-h-10 flex-1 text-xs"
                  disabled={selectedVariant?.stock != null && selectedVariant.stock < 1 || form.processing}
                >
                  <Icon name="shopping-cart" className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {form.processing && submitIntent === "cart" ? "..." : "Keranjang"}
                  </span>
                </Button>
              </MobileStickyCta>
            </form>

            {/* Pengiriman */}
            <div className="mt-5 border border-border p-4">
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
            <div className="mt-5">
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
                    <p className="relative z-10 text-[11px] font-medium leading-tight text-foreground/80">
                      {benefit.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Informasi Produk */}
            <div className="mt-5 border-t border-border">
              <AccordionSection title="Informasi produk" defaultOpen>
                <div className="space-y-1.5 text-sm leading-6">
                  {product.category_label ? (
                    <p>
                      <span className="font-bold text-foreground">Kategori</span>
                      <span className="text-foreground">: {product.category_label}</span>
                    </p>
                  ) : null}
                  {product.model_label ? (
                    <p>
                      <span className="font-bold text-foreground">Model</span>
                      <span className="text-foreground">: {product.model_label}</span>
                    </p>
                  ) : null}
                  {product.design_label ? (
                    <p>
                      <span className="font-bold text-foreground">Desain</span>
                      <span className="text-foreground">: {product.design_label}</span>
                    </p>
                  ) : null}
                </div>
                {attributes.filter(a => !/^(promo_|flash_sale|compare_price|harga_asli|harga_sebelum_diskon)/i.test(a.name)).length ? (
                  <dl className="mt-4 border-t border-border">
                    {attributes.filter(a => !/^(promo_|flash_sale|compare_price|harga_asli|harga_sebelum_diskon)/i.test(a.name)).map((attribute, index) => (
                      <div
                        key={`${attribute.name}-${index}`}
                        className="grid min-w-0 grid-cols-1 gap-3 border-b border-border/60 py-3 text-sm sm:grid-cols-[minmax(7rem,0.65fr)_minmax(0,1fr)] sm:gap-4"
                      >
                        <dt className="min-w-0 break-words font-bold text-foreground">{attribute.name}</dt>
                        <dd className="min-w-0 break-words leading-6 text-foreground">{attribute.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </AccordionSection>

              {product.description ? (
                <AccordionSection title="Tentang produk" defaultOpen>
                  <p className="whitespace-pre-line text-sm leading-6 text-foreground">
                    {product.description}
                  </p>
                </AccordionSection>
              ) : null}
            </div>

            {installationMedia.length ? (
              <section id="hasil-pemasangan" className="mt-5 scroll-mt-28">
                <div className="flex items-end justify-between gap-4">
                  <h2 className="text-base font-bold text-foreground">Hasil pemasangan</h2>
                  <Link
                    href={routeUrl("installation.show", { parent_sku: product.parent_sku })}
                    className="inline-flex h-7 shrink-0 items-center gap-1 text-[11px] font-light text-foreground/80 transition hover:text-primary sm:text-xs"
                  >
                    Lihat semua
                    <Icon name="caret-right" className="size-3 sm:size-3.5" weight="regular" aria-hidden="true" />
                  </Link>
                </div>
                <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {installationMedia.slice(0, 8).map((item) => (
                    <li key={item.id} className="relative flex aspect-[4/3] min-w-0 items-center overflow-hidden border border-border bg-white">
                      <ResponsiveImage
                        src={item.url}
                        alt=""
                        wrapperClassName="size-full bg-white"
                        className="!object-contain"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Penilaian & Ulasan */}
            <section id="penilaian-ulasan" className="mt-5 scroll-mt-28">
              <h2 className="text-base font-bold text-foreground">Penilaian & ulasan</h2>
              {averageRating !== null ? (
                <div className="mt-2 flex items-center gap-2.5">
                  <span className="text-3xl font-normal leading-9 text-foreground">
                    {ratingLabel}/5
                  </span>
                  <StarRow value={averageRating} size="size-5" />
                  <span className="text-sm text-muted-foreground">
                    ({ratedReviews.length} ulasan)
                  </span>
                </div>
              ) : null}

              {reviews.length ? (
                <ul className="mt-4 divide-y divide-border border-t border-border">
                  {reviews.slice(0, 2).map((review) => (
                    <li key={review.id} className="py-4">
                      <div className="flex items-center justify-between gap-4">
                        {(review.rating ?? 0) > 0 ? (
                          <StarRow value={review.rating ?? 0} size="size-3.5" />
                        ) : (
                          <span aria-hidden="true" />
                        )}
                        {review.source ? (
                          <span className="min-w-0 truncate text-xs text-muted-foreground">{humanize(review.source)}</span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Oleh {review.customer_name}
                        {review.location ? ` · ${review.location}` : ""}
                      </p>
                      <p className="mt-2 inline-block max-w-full break-words bg-accent px-1.5 py-0.5 text-xs leading-5 text-accent-foreground">
                        {review.message}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 border-t border-border pt-4 text-sm text-muted-foreground">
                  Belum ada ulasan untuk produk ini. Lihat ulasan pelanggan lain di halaman Ulasan
                  atau tanya detail pemasangan via WhatsApp.
                </p>
              )}
              {reviews.length ? (
                <Link
                  href={routeUrl("reviews")}
                  className="inline-flex h-7 shrink-0 items-center gap-1 text-[11px] font-light text-foreground/80 transition hover:text-primary sm:text-xs"
                >
                  Lihat semua ulasan
                  <Icon name="caret-right" className="size-3 sm:size-3.5" weight="regular" aria-hidden="true" />
                </Link>
              ) : null}
            </section>

          </div>
        </div>
      </section>

      <section className="py-4 border-t border-border">
        <div className="container-page">
          <div className="flex items-end justify-between gap-4">
            <h2 className="min-w-0 break-words text-base font-bold text-foreground">Anda mungkin juga suka</h2>
            <Link
              href={routeUrl("catalog.index")}
              className="inline-flex h-7 shrink-0 items-center gap-1 text-[11px] font-light text-foreground/80 transition hover:text-primary sm:text-xs"
            >
              Lihat semua
              <Icon name="caret-right" className="size-3 sm:size-3.5" weight="regular" aria-hidden="true" />
            </Link>
          </div>
          {relatedProducts.length ? (
            <RelatedCarousel products={relatedProducts} />
          ) : (
            <EmptyState
              className="mt-5"
              title="Belum ada produk terkait"
              description="Lihat seluruh model untuk menemukan pilihan dari kategori lain."
              action={
                <Button asChild>
                  <Link href={routeUrl("catalog.index")}>Lihat model produk</Link>
                </Button>
              }
            />
          )}
        </div>
      </section>
    </PublicLayout>
  )
}
