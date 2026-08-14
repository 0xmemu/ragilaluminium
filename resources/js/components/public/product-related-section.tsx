import { Link } from "@inertiajs/react"
import * as React from "react"

import { ProductCard } from "@/components/public/product-card"
import { ProductCardGrid } from "@/components/public/product-card-grid"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { routeUrl } from "@/lib/routes"
import type { ProductCardData } from "@/types"

/**
 * Section penutup halaman produk: "Anda mungkin juga suka" — grid rekomendasi
 * produk terkait (atau empty state dengan aksi ke katalog).
 * Heading + aksi memakai pola `items-center` yang sama dengan SectionHeading
 * di seluruh website (home, katalog, paling banyak dipesan).
 */
export function ProductRelatedSection({ products }: { products: ProductCardData[] }) {
  const items = products.slice(0, 8)

  return (
    <section className="pt-5 pb-[calc(var(--mobile-sticky-cta-height)+1rem)] border-t border-border lg:pb-5">
      <div className="container-page !px-5 md:!px-8 lg:!px-12">
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 break-words text-base font-bold text-foreground">
            Anda mungkin juga suka
          </h2>
          <Link
            href={routeUrl("catalog.index")}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#474747] transition hover:text-[#333333]"
          >
            <span>Lihat Semua</span>
            <Icon name="arrow-right" className="size-3.5" weight="regular" aria-hidden="true" />
          </Link>
        </div>

        {items.length ? (
          <ProductCardGrid className="mt-4">
            {items.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                priority={index < 4}
                titleStyle="model"
                imageFit="contain"
              />
            ))}
          </ProductCardGrid>
        ) : (
          <EmptyState
            className="mt-4"
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
  )
}
