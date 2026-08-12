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

  // Media yang sedang dilihat di galeri — dipakai gambar "produk terbang" saat add-to-cart.
  const [activeMedia, setActiveMedia] = React.useState<ProductMedia | null>(variantMedia[0] ?? null)

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

      <section className="container-page pb-4 pt-[6px] lg:pb-6">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)] lg:items-start lg:gap-10">
          <ProductGallery items={variantMedia} title={title} onActiveMediaChange={setActiveMedia} />

          <div className="min-w-0 lg:sticky lg:top-28">
            <ProductBuyBox product={product} purchase={purchase} activeMedia={activeMedia} />
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
