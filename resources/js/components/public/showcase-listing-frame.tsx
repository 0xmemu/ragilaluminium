import type { ReactNode } from "react"

import { PageTopBar } from "@/components/public/page-top-bar"
import type { BreadcrumbItem } from "@/components/ui/breadcrumbs"

export function ShowcaseListingFrame({
  title,
  breadcrumbs,
  countLabel,
  toolbar,
  children,
}: {
  title: ReactNode
  breadcrumbs: BreadcrumbItem[]
  countLabel: ReactNode
  toolbar?: ReactNode
  children: ReactNode
}) {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <PageTopBar title={title} breadcrumbs={breadcrumbs} />
      </section>
      <section className="bg-surface py-0">
        <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
          <div className="flex items-center justify-between gap-4 pt-2 pb-1.5 sm:pt-2.5 sm:pb-2">
            <div className="text-xs text-muted-foreground sm:text-sm">{countLabel}</div>
            {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
          </div>
        </div>
      </section>
      <section className="container-page !px-2.5 py-2.5 md:!px-8 lg:!px-12">
        {children}
      </section>
    </>
  )
}
