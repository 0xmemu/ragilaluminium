import { useEffect } from "react"

import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs"
import { Icon } from "@/components/shared/icon"

type PageTopBarProps = {
  breadcrumbs: BreadcrumbItem[]
  title: React.ReactNode
  className?: string
  singleLine?: boolean
  /** Elemen aksi opsional di kanan judul (mobile) / di samping breadcrumb (desktop). */
  right?: React.ReactNode
}

/**
 * SATU komponen header halaman storefront (reusable di semua halaman):
 * - Desktop (md+): breadcrumb di baris 1, judul halaman di baris 2 (2 section terpisah
 *   sesuai kontrak desain desktop).
 * - Mobile (lg-): tombol kembali + judul halaman DALAM SATU BARIS (kontrak: back & judul
 *   satu baris, tidak terpisah), fallback href terakhir bila tak ada history.
 * Komponen ini adalah satu-satunya sumber untuk header / top-bar halaman; halaman TIDAK
 * boleh me-render tombol kembali sendiri (cegah back ganda).
 */
export function PageTopBar({ breadcrumbs, title, className, singleLine, right }: PageTopBarProps) {
  const previousHref = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 1].href : undefined

  useEffect(() => {
    // Simpan href terakhir untuk fallback tombol kembali di mobile.
    if (previousHref) {
      try {
        window.sessionStorage.setItem("page-top-bar:previous-href", previousHref)
      } catch {
        // storage penuh/private mode: fallback ke history biasa.
      }
    }
  }, [previousHref])

  return (
    <section className={className}>
      {/* Desktop: breadcrumb (baris 1) */}
      <div className="container-page hidden py-2 !px-2.5 md:block md:!px-8 lg:!px-12">
        <Breadcrumbs items={breadcrumbs} singleLine={singleLine} />
      </div>

      {/* Judul halaman: desktop di baris 2, mobile dalam satu baris dengan tombol kembali */}
      <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
        <div className="flex min-h-11 items-center gap-2 border-border pt-1 pb-2 sm:pt-1.5 sm:pb-2.5">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back()
                return
              }
              const fallback = previousHref
              if (fallback) {
                window.location.assign(fallback)
              }
            }}
            className="-ml-2 flex size-11 shrink-0 items-center justify-center lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Kembali"
          >
            <Icon name="arrow-left" className="size-5" aria-hidden="true" />
          </button>
          <h1 className="min-w-0 flex-1 text-base font-bold tracking-tight text-foreground">{title}</h1>
          {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
        </div>
      </div>
    </section>
  )
}