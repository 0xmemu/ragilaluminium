import { Link } from "@inertiajs/react"
import * as React from "react"

import { ProductCard } from "@/components/public/product-card"
import { ProductCardGrid } from "@/components/public/product-card-grid"
import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import type { ProductCardData } from "@/types"

/**
 * Section penutup halaman produk: "Anda mungkin juga suka" - grid rekomendasi
 * produk terkait.
 *
 * Kontrak owner 2026-09-16:
 * - Maksimal 8 kartu di mobile, 10 di desktop (dihitung sekali di server; kartu
 *   ke-9 dan ke-10 disembunyikan di layar sempit lewat CSS, jadi tidak ada
 *   perhitungan ulang saat resize maupun risiko mismatch hidrasi).
 * - Section DISEMBUNYIKAN total bila tidak ada rekomendasi (tidak ada empty state).
 * - "Lihat semua" memakai `relatedUrl` dari server: listing dengan filter aktif
 *   (kategori + model + sub model produk ini).
 */
export function ProductRelatedSection({
  products,
  relatedUrl,
}: {
  products: ProductCardData[]
  relatedUrl?: string | null
}) {
  const items = products.slice(0, 10)

  // Tanpa rekomendasi: section tidak dirender sama sekali.
  if (!items.length) return null

  return (
    <section id="produk-terkait" className="pt-5 pb-6 lg:pt-6 lg:pb-8">
      <div className="container-page">
        <div className="!px-2.5 md:!px-8 lg:!px-12">
          <div className="border-t border-border pt-5 lg:pt-6" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="min-w-0 break-words text-base font-bold text-foreground">
              Anda mungkin juga suka
            </h2>
            {relatedUrl ? (
              <Link
                href={relatedUrl}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground lg:text-primary lg:hover:underline"
              >
                <span>Lihat Semua</span>
                <Icon name="arrow-right" className="size-4" weight="bold" aria-hidden="true" />
              </Link>
            ) : null}
          </div>

          <ProductCardGrid className="mt-4">
            {items.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                priority={index < 4}
                titleStyle="model"
                imageFit="contain"
                // Kartu ke-9 dan ke-10 hanya tampil di desktop (>=640px).
                className={cn(index >= 8 && "max-sm:hidden")}
              />
            ))}
          </ProductCardGrid>
        </div>
      </div>
    </section>
  )
}
