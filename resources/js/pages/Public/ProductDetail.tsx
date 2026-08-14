import { Head } from "@inertiajs/react"
import * as React from "react"

import { ProductBuyBox } from "@/components/public/product-buy-box"
import { ProductGallery } from "@/components/public/product-gallery"
import { ProductInfoSections } from "@/components/public/product-info-sections"
import { ProductRelatedSection } from "@/components/public/product-related-section"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
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
 * Halaman detail produk — murni komposisi. State & aksi beli di `useProductPurchase`,
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
  const { title, variantMedia, productSchema, averageRating, ratingLabel, ratedReviews } = purchase

  const shareUrl = React.useMemo(() => {
    if (typeof window === "undefined") {
      return routeUrl("product.show", { parent_sku: product.parent_sku })
    }

    const url = new URL(window.location.href)
    if (purchase.selectedVariant?.variant_sku) {
      url.searchParams.set("variant", purchase.selectedVariant.variant_sku)
    }
    return url.toString()
  }, [product.parent_sku, purchase.selectedVariant?.variant_sku])

  const socialImage = variantMedia.find((item) => item.url)?.url ?? null
  const socialImageUrl = React.useMemo(() => {
    if (!socialImage) return null
    if (typeof window === "undefined") return socialImage
    return new URL(socialImage, window.location.origin).toString()
  }, [socialImage])

  // Media yang sedang dilihat di galeri — dipakai gambar "produk terbang" saat add-to-cart.
  const [activeMedia, setActiveMedia] = React.useState<ProductMedia | null>(variantMedia[0] ?? null)

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

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden py-2 sm:block">
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

      <section className="container-page pb-4 pt-4 lg:pb-6 sm:pt-0 lg:pt-6">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)] lg:items-start lg:gap-10">
          <ProductGallery items={variantMedia} title={title} onActiveMediaChange={setActiveMedia} />

          <div className="min-w-0 lg:sticky lg:top-28">
            <ProductBuyBox
              product={product}
              purchase={purchase}
              activeMedia={activeMedia}
              shareUrl={shareUrl}
            />
            <ProductInfoSections
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
      </section>

      <ProductRelatedSection products={relatedProducts} />
    </PublicLayout>
  )
}
