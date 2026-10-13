import type { ReactNode } from "react"

import { PageTopBar } from "@/components/public/page-top-bar"
import type { BreadcrumbItem } from "@/components/ui/breadcrumbs"

export function ProductListingFrame({
  title,
  breadcrumbs,
  toolbar,
  beforeChildren,
  children,
  pagination,
  titleRight,
}: {
  title: ReactNode
  breadcrumbs: BreadcrumbItem[]
  toolbar: ReactNode
  beforeChildren?: ReactNode
  children: ReactNode
  pagination: ReactNode
  /** Elemen di kanan judul halaman (mis. hitung mundur Flash Sale). */
  titleRight?: ReactNode
}) {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <PageTopBar title={title} breadcrumbs={breadcrumbs} right={titleRight} />
      </section>
      {toolbar}
      {beforeChildren}
      <section className="container-page !px-2.5 py-2.5 md:!px-8 lg:!px-12">
        {children}
        {pagination}
      </section>
    </>
  )
}