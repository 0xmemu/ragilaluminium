import { Skeleton } from "@/components/ui/skeleton"
import { productCardGridClassName } from "@/components/public/product-card-grid"
import { ProductGridSkeleton } from "@/components/ui/skeleton"

/** Blok shimmer dasar. */
function Block({ className }: { className?: string }) {
  return <Skeleton className={className} />
}

/** Header konsisten: breadcrumb + judul (dipakai sebagian besar halaman). */
function PageHeaderSkeleton() {
  return (
    <div className="border-b border-border bg-surface">
      <div className="container-page hidden py-2 md:block md:!px-8 lg:!px-12">
        <div className="flex items-center gap-2">
          <Block className="h-4 w-14" />
          <Block className="h-4 w-3" />
          <Block className="h-4 w-24" />
        </div>
      </div>
      <div className="container-page py-2 !px-2.5 md:!px-8 lg:!px-12">
        <Block className="h-6 w-44" />
      </div>
    </div>
  )
}

/** HOME: hero besar + judul section + grid produk. */
export function HomePageSkeleton() {
  return (
    <div aria-busy="true">
      <div className="sr-only" role="status" aria-live="polite">
        Memuat halaman
      </div>
      <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
        <Block className="mt-4 h-44 w-full rounded-xl md:h-64" />
        <div className="mt-6">
          <Block className="mb-4 h-6 w-48" />
          <div className={productCardGridClassName}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="product-card">
                <div className="product-card__media">
                  <Block className="size-full rounded-none" />
                </div>
                <div className="product-card__content space-y-2">
                  <Block className="h-4 w-3/4" />
                  <Block className="h-5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** CATALOG: pakai ProductGridSkeleton yang sudah ada (grid produk asli). */
const CatalogPageSkeleton = ProductGridSkeleton

/** DETAIL PRODUK: gallery kiri + info kanan. */
export function DetailPageSkeleton() {
  return (
    <div aria-busy="true">
      <div className="sr-only" role="status" aria-live="polite">
        Memuat halaman
      </div>
      <div className="container-page !px-2.5 pt-4 md:!px-8 lg:!px-12 lg:py-8">
        <div className="mb-4 flex items-center gap-2">
          <Block className="h-4 w-14" />
          <Block className="h-4 w-3" />
          <Block className="h-4 w-28" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Block className="aspect-square w-full rounded-xl" />
          <div className="space-y-4">
            <Block className="h-8 w-3/4" />
            <Block className="h-6 w-32" />
            <Block className="h-24 w-full rounded-lg" />
            <Block className="h-12 w-full rounded-lg" />
            <Block className="h-12 w-full rounded-lg" />
            <Block className="h-20 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** CART: list item horizontal + ringkasan kanan. */
export function CartPageSkeleton() {
  return (
    <div aria-busy="true">
      <div className="sr-only" role="status" aria-live="polite">
        Memuat halaman
      </div>
      <PageHeaderSkeleton />
      <div className="container-page grid min-w-0 gap-4 pt-4 !px-2.5 md:!px-8 lg:!grid-cols-[minmax(0,1fr)_18rem] lg:!px-12 lg:py-8">
        <div className="min-w-0 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 rounded-lg border border-border p-3">
              <Block className="size-20 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2">
                <Block className="h-4 w-2/3" />
                <Block className="h-4 w-24" />
                <Block className="h-8 w-28 rounded-md" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden space-y-3 lg:block">
          <Block className="h-40 w-full rounded-lg" />
          <Block className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/** CHECKOUT: form kiri + ringkasan kanan - BUKAN grid produk. */
export function CheckoutPageSkeleton() {
  return (
    <div aria-busy="true">
      <div className="sr-only" role="status" aria-live="polite">
        Memuat halaman
      </div>
      <PageHeaderSkeleton />
      <div className="container-page grid min-w-0 gap-4 pt-4 !px-2.5 md:!px-8 lg:!grid-cols-[minmax(0,1fr)_18rem] lg:!px-12 lg:py-8">
        <div className="min-w-0 space-y-4">
          {/* Stepper */}
          <div className="flex items-center gap-2">
            <Block className="size-5 rounded-full" />
            <Block className="h-4 w-24" />
            <Block className="h-px flex-1" />
            <Block className="size-5 rounded-full" />
            <Block className="h-4 w-24" />
            <Block className="h-px flex-1" />
            <Block className="size-5 rounded-full" />
            <Block className="h-4 w-20" />
          </div>
          {/* Form alamat */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            <Block className="h-5 w-40" />
            <Block className="h-10 w-full rounded-md" />
            <Block className="h-10 w-full rounded-md" />
            <Block className="h-10 w-full rounded-md" />
            <Block className="h-10 w-2/3 rounded-md" />
          </div>
          {/* Pembayaran */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            <Block className="h-5 w-32" />
            <Block className="h-12 w-full rounded-md" />
            <Block className="h-12 w-full rounded-md" />
          </div>
        </div>
        <div className="hidden space-y-3 lg:block">
          <Block className="h-44 w-full rounded-lg" />
          <Block className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/** Halaman lain (FAQ, info, dll): konten blok ringan - bukan grid produk. */
export function GenericPageSkeleton() {
  return (
    <div aria-busy="true">
      <div className="sr-only" role="status" aria-live="polite">
        Memuat halaman
      </div>
      <PageHeaderSkeleton />
      <div className="container-page space-y-4 pt-4 !px-2.5 md:!px-8 lg:!px-12 lg:py-8">
        <Block className="h-6 w-56" />
        <Block className="h-24 w-full rounded-lg" />
        <Block className="h-24 w-full rounded-lg" />
        <Block className="h-24 w-2/3 rounded-lg" />
      </div>
    </div>
  )
}

/** Pilih skeleton sesuai pathname halaman TUJUAN. */
export function skeletonForPath(pathname: string) {
  if (pathname === "/") return <HomePageSkeleton />
  if (pathname.startsWith("/product/")) return <DetailPageSkeleton />
  if (pathname.startsWith("/products") || pathname.startsWith("/flash-sale") || pathname.startsWith("/promo")) {
    return <CatalogPageSkeleton />
  }
  if (pathname.startsWith("/cart")) return <CartPageSkeleton />
  if (pathname.startsWith("/checkout")) return <CheckoutPageSkeleton />
  return <GenericPageSkeleton />
}
