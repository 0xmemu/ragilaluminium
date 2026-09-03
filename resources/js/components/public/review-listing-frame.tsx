import type { ReactNode } from "react"

import { PageTopBar } from "@/components/public/page-top-bar"
import { Pagination } from "@/components/ui/pagination"
import type { BreadcrumbItem } from "@/components/ui/breadcrumbs"
import type { Pagination as PaginationData } from "@/types"

export function ReviewListingFrame({
  title,
  breadcrumbs,
  summary,
  children,
  pagination,
}: {
  title: ReactNode
  breadcrumbs: BreadcrumbItem[]
  summary?: ReactNode
  children: ReactNode
  pagination?: PaginationData | null
}) {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <PageTopBar title={title} breadcrumbs={breadcrumbs} />
      </section>
      {summary ? (
        <section className="bg-surface py-0">
          <div className="container-page !px-2.5 py-2 md:!px-8 lg:!px-12">{summary}</div>
        </section>
      ) : null}
      <section className="container-page !px-2.5 py-4 pb-6 md:!px-8 lg:!px-12 lg:pb-8">
        <div className="flex min-w-0 flex-col gap-8">
          {children}
          {pagination ? <Pagination pagination={pagination} className="mt-0" /> : null}
        </div>
      </section>
    </>
  )
}
