import type { ReactNode } from "react"

import { PageTopBar } from "@/components/public/page-top-bar"
import type { BreadcrumbItem } from "@/components/ui/breadcrumbs"

export function ProductListingFrame({
  title,
  breadcrumbs,
  toolbar,
  children,
  pagination,
}: {
  title: ReactNode
  breadcrumbs: BreadcrumbItem[]
  toolbar: ReactNode
  children: ReactNode
  pagination: ReactNode
}) {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <PageTopBar title={title} breadcrumbs={breadcrumbs} />
      </section>
      {toolbar}
      <section className="container-page !px-2.5 pt-4 md:!px-8 lg:!px-12">
        {children}
      </section>
      {pagination}
    </>
  )
}
