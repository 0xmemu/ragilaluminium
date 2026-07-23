import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { ProductCard } from "@/components/public/product-card"
import { ProductCardGrid } from "@/components/public/product-card-grid"
import { MobileStickyCta } from "@/components/public/mobile-sticky-cta"
import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/ui/alert"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { QuantityControl } from "@/components/ui/quantity-control"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import PublicLayout from "@/layouts/public-layout"
import { formatCurrency, humanize, productName } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  firstAvailableSelections,
  resolveVariant,
  variantAxes,
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
        <span className="text-base font-bold text-foreground">{title}</span>
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
  const axes = React.useMemo(() => variantAxes(variants), [variants])
  const initialSelections = React.useMemo(() => firstAvailableSelections(variants), [variants])
  const firstAvailable = variants.find((variant) => variant.stock > 0) ?? variants[0] ?? null
  const [selections, setSelections] = React.useState<VariantSelections>(initialSelections)
  const [directVariantId, setDirectVariantId] = React.useState<number | null>(
    axes.length ? null : firstAvailable?.id ?? null,
  )

  const selectedVariant =
    axes.length > 0
      ? resolveVariant(variants, selections)
      : variants.find((variant) => variant.id === directVariantId) ?? null

  const variantMedia = React.useMemo(() => {
    if (!selectedVariant) return media
    const dedicated = media.filter((item) => item.product_variant_id === selectedVariant.id)
    if (dedicated.length) return dedicated
    return media.filter((item) => !item.product_variant_id)
  }, [media, selectedVariant])
  const [activeMediaIndex, setActiveMediaIndex] = React.useState(0)

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

  function chooseAxis(axisName: string, option: string) {
    const next = { ...selections, [axisName]: option }
    const nextVariant = resolveVariant(variants, next)
    setSelections(next)
    form.setData("variant_sku", nextVariant?.variant_sku ?? "")
    form.clearErrors()
  }

  function chooseDirectVariant(id: number) {
    const nextVariant = variants.find((variant) => variant.id === id) ?? null
    setDirectVariantId(id)
    form.setData("variant_sku", nextVariant?.variant_sku ?? "")
    form.setData("quantity", 1)
    form.clearErrors()
  }

  function addToCart(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedVariant || selectedVariant.stock < 1) return

    setSubmitIntent("cart")
    form.post(routeUrl("cart.add"), {
      preserveScroll: true,
      onSuccess: () => form.setData("quantity", 1),
      onFinish: () => setSubmitIntent(null),
    })
  }

  function buyNow() {
    if (!selectedVariant || selectedVariant.stock < 1) return

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
  const comparePrice =
    promo?.compare_price && currentPrice !== null && promo.compare_price > currentPrice
      ? promo.compare_price
      : null
  const discountPercent = comparePrice && currentPrice !== null
    ? Math.round(((comparePrice - currentPrice) / comparePrice) * 100)
    : null

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

      <section className="container-page py-4 lg:py-5">
        <Breadcrumbs items={product.breadcrumbs ?? []} />
      </section>

      <section className="container-page pb-14 lg:pb-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)] lg:items-start lg:gap-10">
          <div className="group/gallery" aria-label="Galeri produk">
            {activeMedia ? (
              <>
                {/* Tombol berada di luar frame pada desktop dan muncul saat galeri di-hover/focus. */}
                <div className="relative mx-auto aspect-square w-full max-w-[min(100%,calc(100dvh-12rem))] bg-white">
                  <ResponsiveImage
                    key={activeMedia.id}
                    src={activeMedia.url}
                    alt={`${title}, foto ${activeMediaIndex + 1}`}
                    loading="eager"
                    fetchPriority="high"
                    wrapperClassName="size-full bg-white"
                    className="object-contain"
                  />

                  {variantMedia.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => moveGallery(-1)}
                        disabled={activeMediaIndex === 0}
                        aria-label="Lihat foto sebelumnya"
                        className="absolute left-2 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#525252] text-white opacity-100 shadow-md transition-[opacity,background-color] hover:bg-[#303030] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed md:-left-14 md:size-12 md:opacity-0 md:group-hover/gallery:opacity-100 md:group-focus-within/gallery:opacity-100 md:group-hover/gallery:disabled:opacity-35 md:group-focus-within/gallery:disabled:opacity-35"
                      >
                        <Icon name="caret-left" className="size-6" weight="bold" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveGallery(1)}
                        disabled={activeMediaIndex === variantMedia.length - 1}
                        aria-label="Lihat foto berikutnya"
                        className="absolute right-2 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#525252] text-white opacity-100 shadow-md transition-[opacity,background-color] hover:bg-[#303030] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed md:-right-14 md:size-12 md:opacity-0 md:group-hover/gallery:opacity-100 md:group-focus-within/gallery:opacity-100 md:group-hover/gallery:disabled:opacity-35 md:group-focus-within/gallery:disabled:opacity-35"
                      >
                        <Icon name="caret-right" className="size-6" weight="bold" aria-hidden="true" />
                      </button>
                    </>
                  ) : null}
                </div>

                {variantMedia.length > 1 ? (
                  <div
                    className="scrollbar-none mt-3 flex snap-x gap-3 overflow-x-auto px-1 pb-1 sm:mt-4 sm:justify-center"
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

          <div className="lg:sticky lg:top-28">
            {/* Header: subtitle brand + pill rating */}
            <div className="flex items-start justify-between gap-4">
              <Link
                href={product.model_href ?? routeUrl("catalog.index")}
                className="text-lg font-bold leading-snug text-foreground hover:text-primary"
              >
                {product.subtitle}
              </Link>
              {averageRating !== null ? (
                <a
                  href="#penilaian-ulasan"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 transition hover:border-foreground/30"
                  aria-label={`Nilai ${ratingLabel} dari 5, ${ratedReviews.length} ulasan`}
                >
                  <span className="text-[11px] font-bold leading-4 text-primary">{ratingLabel}</span>
                  <StarRow value={averageRating} size="size-2.5" />
                  <span className="h-4 w-px bg-border" aria-hidden="true" />
                  <span className="text-[11px] font-bold leading-4 text-muted-foreground">
                    {ratedReviews.length}
                  </span>
                </a>
              ) : null}
            </div>

            <h1 className="mt-1 text-sm leading-6 text-foreground">{title}</h1>

            {/* Harga + promo */}
            <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="tabular-nums text-2xl font-bold leading-8 text-sale">
                {currentPrice !== null
                  ? `${selectedVariant ? "" : "Mulai "}${formatCurrency(currentPrice)}`
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
                <span className="inline-flex items-center">
                  <Icon name="lightning" weight="fill" className="-mr-px size-4 shrink-0 text-sale" aria-hidden />
                  <span className="text-base font-extrabold italic leading-5 tracking-tight text-sale">FLASH SALE</span>
                </span>
              ) : null}
            </div>

            <form onSubmit={addToCart} className="mt-6">
              {/* Variasi (axes) */}
              {axes.map((axis) => (
                <fieldset key={axis.name} className="mt-5">
                  <legend className="flex items-baseline gap-2">
                    <span className="text-base font-bold text-foreground">{axis.name}</span>
                    {selections[axis.name] ? (
                      <span className="text-sm text-muted-foreground">{selections[axis.name]}</span>
                    ) : null}
                  </legend>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {axis.options.map((option) => (
                      <button
                        type="button"
                        key={option}
                        onClick={() => chooseAxis(axis.name, option)}
                        className={cn(
                          "min-h-10 rounded-full border px-4 text-sm font-semibold transition",
                          selections[axis.name] === option
                            ? "border-foreground bg-foreground text-white"
                            : "border-border bg-surface text-foreground hover:border-foreground/40",
                        )}
                        aria-pressed={selections[axis.name] === option}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}

              {/* Ukuran / varian langsung */}
              {axes.length === 0 && variants.length > 1 ? (
                <fieldset className="mt-5">
                  <legend className="flex items-baseline gap-2">
                    <span className="text-base font-bold text-foreground">Ukuran</span>
                    {selectedVariant ? (
                      <span className="text-sm text-muted-foreground">
                        {selectedVariant.dimension_compact ?? selectedVariant.label}
                      </span>
                    ) : null}
                  </legend>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {variants.map((variant) => (
                      <button
                        type="button"
                        key={variant.id}
                        onClick={() => chooseDirectVariant(variant.id)}
                        disabled={variant.stock < 1}
                        className={cn(
                          "min-h-10 rounded-full border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
                          directVariantId === variant.id
                            ? "border-foreground bg-foreground text-white"
                            : "border-border bg-surface text-foreground hover:border-foreground/40",
                        )}
                        aria-pressed={directVariantId === variant.id}
                      >
                        {variant.dimension_compact ?? variant.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              {selectedVariant ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {selectedVariant.dimension_label ?? selectedVariant.label}
                  </span>
                  <span
                    className={cn(
                      "font-semibold",
                      selectedVariant.stock > 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {selectedVariant.stock > 0
                      ? `Stok ${selectedVariant.stock} tersedia`
                      : "Stok tidak tersedia"}
                  </span>
                </div>
              ) : variants.length ? (
                <Alert className="mt-4" tone="warning" title="Lengkapi pilihan varian">
                  Pilih setiap opsi agar harga dan stok yang tepat dapat ditampilkan.
                </Alert>
              ) : (
                <Alert className="mt-4" tone="warning" title="Varian belum tersedia">
                  Produk ini belum dapat ditambahkan ke keranjang.
                </Alert>
              )}

              {form.errors.variant_sku || form.errors.parent_sku || form.errors.quantity ? (
                <Alert className="mt-4" tone="danger" title="Produk belum dapat ditambahkan">
                  {form.errors.variant_sku ?? form.errors.parent_sku ?? form.errors.quantity}
                </Alert>
              ) : null}

              {/* CTA — desktop / tablet in-flow */}
              <div className="mt-5 hidden gap-3 lg:flex">
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 flex-1"
                  disabled={!selectedVariant || selectedVariant.stock < 1 || form.processing}
                >
                  <Icon name="shopping-cart" className="size-5" aria-hidden="true" />
                  {form.processing && submitIntent === "cart" ? "Menambahkan..." : "Tambah ke keranjang"}
                </Button>
                <QuantityControl
                  className="h-12"
                  value={form.data.quantity}
                  onChange={(quantity) => form.setData("quantity", quantity)}
                  max={selectedVariant?.stock}
                  disabled={!selectedVariant || selectedVariant.stock < 1 || form.processing}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="mt-3 hidden h-12 w-full lg:inline-flex"
                disabled={!selectedVariant || selectedVariant.stock < 1 || form.processing}
                onClick={buyNow}
              >
                <Icon name="credit-card" className="size-5" aria-hidden="true" />
                {form.processing && submitIntent === "checkout" ? "Menuju checkout..." : "Beli sekarang"}
              </Button>

              <MobileStickyCta
                aria-label="Beli produk"
                spacerClassName="h-[7.25rem]"
                className="[&>div]:flex-col [&>div]:items-stretch"
              >
                <div className="flex w-full gap-2">
                  <Button
                    type="submit"
                    size="lg"
                    className="h-11 min-h-11 flex-1"
                    disabled={!selectedVariant || selectedVariant.stock < 1 || form.processing}
                  >
                    <Icon name="shopping-cart" className="size-5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {form.processing && submitIntent === "cart" ? "Menambahkan..." : "Tambah ke keranjang"}
                    </span>
                  </Button>
                  <QuantityControl
                    className="h-11"
                    value={form.data.quantity}
                    onChange={(quantity) => form.setData("quantity", quantity)}
                    max={selectedVariant?.stock}
                    disabled={!selectedVariant || selectedVariant.stock < 1 || form.processing}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="h-11 min-h-11 w-full"
                  disabled={!selectedVariant || selectedVariant.stock < 1 || form.processing}
                  onClick={buyNow}
                >
                  <Icon name="credit-card" className="size-5 shrink-0" aria-hidden="true" />
                  {form.processing && submitIntent === "checkout" ? "Menuju checkout..." : "Beli sekarang"}
                </Button>
              </MobileStickyCta>
            </form>

            {/* Pengiriman */}
            <div className="mt-8 border border-border p-4">
              <h2 className="text-base font-bold text-foreground">Pengiriman</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Dikirim ke seluruh Indonesia via J&T Cargo. Ongkos kirim dihitung saat checkout
                berdasarkan alamat tujuan.{" "}
                <Link href={routeUrl("order.status")} className="font-semibold text-primary hover:underline">
                  Lacak pesanan
                </Link>
              </p>
            </div>

            {/* Benefit belanja */}
            <div className="mt-8">
              <h2 className="text-sm font-bold text-foreground">
                Mengapa Anda akan suka belanja di Ragil Aluminium
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {benefits.map((benefit, index) => (
                  <div
                    key={benefit.label}
                    className={cn(
                      "relative flex min-h-[4.5rem] items-center overflow-hidden p-3 sm:min-h-[6.5rem] sm:items-start",
                      BENEFIT_TINTS[index % BENEFIT_TINTS.length],
                    )}
                  >
                    <p className="relative z-10 text-sm font-semibold leading-5 text-foreground">
                      {benefit.label}
                    </p>
                    <Icon
                      name={benefit.icon}
                      className="absolute -bottom-4 -right-4 size-16 text-foreground/10 sm:size-20"
                      weight="fill"
                      aria-hidden="true"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Informasi Produk */}
            <div className="mt-8 border-t border-border">
              <AccordionSection title="Informasi produk">
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
                {attributes.length ? (
                  <dl className="mt-4 border-t border-border">
                    {attributes.map((attribute, index) => (
                      <div
                        key={`${attribute.name}-${index}`}
                        className="grid grid-cols-[minmax(7rem,0.65fr)_1fr] gap-4 border-b border-border/60 py-3 text-sm"
                      >
                        <dt className="font-bold text-foreground">{attribute.name}</dt>
                        <dd className="leading-6 text-foreground">{attribute.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </AccordionSection>

              {product.description ? (
                <AccordionSection title="Tentang produk">
                  <p className="whitespace-pre-line text-sm leading-6 text-foreground">
                    {product.description}
                  </p>
                </AccordionSection>
              ) : null}
            </div>

            {installationMedia.length ? (
              <section id="hasil-pemasangan" className="mt-8 scroll-mt-28">
                <div className="flex items-end justify-between gap-4">
                  <h2 className="text-lg font-bold text-foreground">Hasil pemasangan</h2>
                  <Link
                    href={routeUrl("installation.show", { parent_sku: product.parent_sku })}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    Lihat semua
                  </Link>
                </div>
                <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {installationMedia.slice(0, 8).map((item) => (
                    <li key={item.id} className="aspect-square overflow-hidden border border-border bg-muted/20">
                      <ResponsiveImage
                        src={item.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Penilaian & Ulasan */}
            <section id="penilaian-ulasan" className="mt-8 scroll-mt-28">
              <h2 className="text-lg font-bold text-foreground">Penilaian & ulasan</h2>
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
                  {reviews.slice(0, 6).map((review) => (
                    <li key={review.id} className="py-4">
                      <div className="flex items-center justify-between gap-4">
                        {(review.rating ?? 0) > 0 ? (
                          <StarRow value={review.rating ?? 0} size="size-3.5" />
                        ) : (
                          <span aria-hidden="true" />
                        )}
                        {review.source ? (
                          <span className="text-xs text-muted-foreground">{humanize(review.source)}</span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Oleh {review.customer_name}
                        {review.location ? ` · ${review.location}` : ""}
                      </p>
                      <p className="mt-2 inline-block bg-accent px-1.5 py-0.5 text-xs leading-5 text-accent-foreground">
                        {review.message}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 border-t border-border pt-4 text-sm text-muted-foreground">
                  Belum ada ulasan untuk produk ini.
                </p>
              )}
              {reviews.length ? (
                <Link
                  href={routeUrl("reviews")}
                  className="mt-2 inline-flex text-sm font-semibold text-primary hover:underline"
                >
                  Lihat semua ulasan
                </Link>
              ) : null}
            </section>
          </div>
        </div>
      </section>

      <section className="section-space border-t border-border">
        <div className="container-page">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-lg font-bold text-foreground">Anda mungkin juga suka</h2>
            <Link
              href={routeUrl("catalog.index")}
              className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-[#1A1D1C] bg-white px-5 text-sm font-semibold text-[#1A1D1C] transition hover:bg-[#1A1D1C]/5"
            >
              Lihat semua
            </Link>
          </div>
          {relatedProducts.length ? (
            <ProductCardGrid className="mt-6">
              {relatedProducts.map((related) => (
                <ProductCard key={related.id} product={related} />
              ))}
            </ProductCardGrid>
          ) : (
            <EmptyState
              className="mt-8"
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
