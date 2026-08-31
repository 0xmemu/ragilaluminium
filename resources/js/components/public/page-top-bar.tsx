import { useEffect } from "react"

import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs"
import { Icon } from "@/components/shared/icon"

/**
 * Satu sumber top-bar halaman storefront:
 * - Desktop (md+): breadcrumb.
 * - Mobile: tombol kembali (history.back()), fallback href terakhir bila tak ada history.
 * Adaptif via CSS; markup satu sumber (dilarang copy-paste pola ini per halaman).
 */
export function PageTopBar({
  breadcrumbs,
  className,
  singleLine,
}: {
  breadcrumbs: BreadcrumbItem[]
  className?: string
  singleLine?: boolean
}) {
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
    <>
      <div className={className}>
        <div className="container-page hidden md:block py-2 !px-2.5 md:!px-8 lg:!px-12">
          <Breadcrumbs items={breadcrumbs} singleLine={singleLine} />
        </div>
        <div className="container-page py-2 !px-2.5 md:!px-8 lg:!px-12 lg:hidden">
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
            className="-ml-2 flex size-11 shrink-0 items-center justify-center"
            aria-label="Kembali"
          >
            <Icon name="arrow-left" className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  )
}
