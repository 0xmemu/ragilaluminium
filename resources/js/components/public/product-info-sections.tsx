import { Link } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { humanize } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { ProductAttribute, ProductDetailData, Testimonial } from "@/types"

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

/**
 * Bagian bawah kolom kanan halaman produk: Informasi produk & Tentang produk
 * (accordion), Hasil pemasangan, dan Penilaian & ulasan.
 * Semua nilai turunan (rating, ulasan terfilter) datang sebagai props (§5 R).
 */
export function ProductInfoSections({
  product,
  attributes,
  installationMedia = [],
  reviews,
  averageRating,
  ratingLabel,
  ratedReviews,
}: {
  product: ProductDetailData
  attributes: ProductAttribute[]
  installationMedia?: Array<{ id: number; url: string; thumb?: string | null }>
  reviews: Testimonial[]
  averageRating: number | null
  ratingLabel: string | null
  ratedReviews: Testimonial[]
}) {
  const visibleAttributes = attributes.filter(
    (a) => !/^(promo_|flash_sale|compare_price|harga_asli|harga_sebelum_diskon)/i.test(a.name),
  )

  return (
    <>
      {/* Informasi Produk */}
      <div className="mt-4 border-t border-border">
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
          {visibleAttributes.length ? (
            <dl className="mt-4 border-t border-border">
              {visibleAttributes.map((attribute, index) => (
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
        <section id="hasil-pemasangan" className="mt-4 scroll-mt-28">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-base font-bold text-foreground">Hasil pemasangan</h2>
            <Link
              href={routeUrl("installation.show", { parent_sku: product.parent_sku })}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-light text-foreground/80 transition hover:text-primary"
            >
              Lihat semua →
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
      <section id="penilaian-ulasan" className="mt-4 scroll-mt-28">
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
            className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-light text-foreground/80 transition hover:text-primary"
          >
            Lihat semua →
          </Link>
        ) : null}
      </section>
    </>
  )
}
