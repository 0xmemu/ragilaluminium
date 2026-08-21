import { Skeleton } from "@/components/ui/skeleton"

/** Skeleton transisi halaman storefront — tampil saat navigasi Inertia antar halaman. */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6" aria-busy="true">
      <div className="sr-only" role="status" aria-live="polite">
        Memuat halaman
      </div>

      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Judul halaman */}
      <Skeleton className="mb-6 h-8 w-56" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* Area konten utama */}
        <div className="space-y-4">
          <Skeleton className="h-36 w-full" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar kanan (desktop) */}
        <div className="hidden space-y-4 lg:block">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </div>
  )
}
