import { Head, router } from "@inertiajs/react"
import * as React from "react"

import { ProductBuyBox } from "@/components/public/product-buy-box"
import { ShareActionButton } from "@/components/public/share-action-button"
import { ProductGallery } from "@/components/public/product-gallery"
import { ProductInfoSections } from "@/components/public/product-info-sections"
import { ProductRelatedSection } from "@/components/public/product-related-section"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Icon } from "@/components/shared/icon"
import { useProductPurchase } from "@/hooks/use-product-purchase"
import PublicLayout from "@/layouts/public-layout"
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

/**
 * Halaman detail produk - murni komposisi. State & aksi beli di `useProductPurchase`,
 * tiap section (galeri, buy box, info, terkait) adalah komponen props-only (§5 R).
 */
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
  const purchase = useProductPurchase({ product, attributes, variants, media, reviews, promo })
  const { title, variantMedia, highlightedMediaId, productSchema, averageRating, ratingLabel, ratedReviews } = purchase

  const shareUrl = React.useMemo(() => {
    if (typeof window === "undefined") {
      const base = routeUrl("product.show", { parent_sku: product.parent_sku })
      const variantSku = purchase.selectedVariant?.variant_sku
      const separator = base.includes("?") ? "&" : "?"
      return variantSku
        ? base + separator + "variant=" + encodeURIComponent(variantSku)
        : base
    }

    const url = new URL(window.location.href)
    if (purchase.selectedVariant?.variant_sku) {
      url.searchParams.set("variant", purchase.selectedVariant.variant_sku)
    }
    return url.toString()
  }, [product.parent_sku, purchase.selectedVariant])

  const socialImage = variantMedia.find((item) => item.url)?.url ?? null
  const socialImageUrl = React.useMemo(() => {
    if (!socialImage) return null
    if (typeof window === "undefined") return socialImage
    return new URL(socialImage, window.location.origin).toString()
  }, [socialImage])

  // Media yang sedang dilihat di galeri - dipakai gambar "produk terbang" saat add-to-cart.
  const [activeMedia, setActiveMedia] = React.useState<ProductMedia | null>(variantMedia[0] ?? null)

  const handlePdpBack = React.useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back()
    } else {
      router.visit(routeUrl("catalog.index"))
    }
  }, [])



  return (
    <PublicLayout>
      <Head title={title}>
        <meta
          name="description"
          content={(product.description ?? product.subtitle ?? title).slice(0, 155)}
        />
        <meta head-key="product-og-type" property="og:type" content="product" />
        <meta head-key="product-og-title" property="og:title" content={title} />
        <meta
          head-key="product-og-description"
          property="og:description"
          content={(product.description ?? product.subtitle ?? title).slice(0, 200)}
        />
        <meta head-key="product-og-url" property="og:url" content={shareUrl} />
        {socialImageUrl ? (
          <meta head-key="product-og-image" property="og:image" content={socialImageUrl} />
        ) : null}
        <meta head-key="product-twitter-card" name="twitter:card" content="summary_large_image" />
        <meta head-key="product-twitter-title" name="twitter:title" content={title} />
        {socialImageUrl ? (
          <meta head-key="product-twitter-image" name="twitter:image" content={socialImageUrl} />
        ) : null}
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
      </Head>

      <section className="hidden md:block border-b border-border bg-surface">
        <div className="container-page py-2 !px-2.5 md:!px-8 lg:!px-12">
          <div className="flex items-center gap-3">
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
        </div>
      </section>



      <section className="container-page !px-2.5 md:!px-8 lg:!px-12 pb-4 pt-0 lg:pt-5 lg:pb-5">
        <div className="grid min-w-0 gap-2 lg:grid-cols-[480px_minmax(0,1fr)] lg:items-start lg:gap-8">
          {/* Kolom Kiri: Galeri Produk */}
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={handlePdpBack}
              className="absolute left-2 top-2 z-20 inline-flex size-11 items-center justify-center rounded-full bg-foreground/70 text-background shadow-md backdrop-blur-sm transition hover:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
              aria-label="Kembali"
            >
              <Icon name="arrow-left" className="size-5" aria-hidden="true" />
            </button>
            <div className="absolute right-2 top-2 z-20 lg:hidden">
              <ShareActionButton title={title} url={shareUrl} />
            </div>
            <ProductGallery items={variantMedia} title={title} onActiveMediaChange={setActiveMedia} highlightedMediaId={highlightedMediaId} />
          </div>

          {/* Kolom Kanan: Buy Box + (Mobile: Semua Info / Desktop: Accordion Info & Deskripsi) */}
          <div className="min-w-0 lg:sticky lg:top-14">
            <ProductBuyBox
              product={product}
              purchase={purchase}
              activeMedia={activeMedia}
              shareUrl={shareUrl}
            />
            {/* Mobile view: tampilkan semua info section (accordion, ulasan, pemasangan) */}
            <div className="lg:hidden">
              <ProductInfoSections
                mode="all"
                product={product}
                attributes={attributes}
                installationMedia={installationMedia}
                reviews={reviews}
                averageRating={averageRating}
                ratingLabel={ratingLabel}
                ratedReviews={ratedReviews}
              />
            </div>
            {/* Desktop view: hanya accordion Informasi Produk & Tentang Produk */}
            <div className="hidden lg:block">
              <ProductInfoSections
                mode="info"
                product={product}
                attributes={attributes}
                installationMedia={installationMedia}
                reviews={reviews}
                averageRating={averageRating}
                ratingLabel={ratingLabel}
                ratedReviews={ratedReviews}
              />
            </div>
          </div>
        </div>

        {/* Desktop only: Section Full Width Ulasan Pembeli (Carousel) & Hasil Pemasangan (Horizontal) */}
        <div className="hidden lg:block mt-10 border-t border-border pt-8">
          <ProductInfoSections
            mode="reviews-installation"
            product={product}
            attributes={attributes}
            installationMedia={installationMedia}
            reviews={reviews}
            averageRating={averageRating}
            ratingLabel={ratingLabel}
            ratedReviews={ratedReviews}
          />
        </div>
      </section>

      <ProductRelatedSection products={relatedProducts} />
    </PublicLayout>
  )
}
