import type { ReactNode } from "react"

import { PageTopBar } from "@/components/public/page-top-bar"
import type { BreadcrumbItem } from "@/components/ui/breadcrumbs"

export function HelpPageFrame({
  title,
  breadcrumbs,
  subtitle,
  children,
  footer,
}: {
  title: ReactNode
  breadcrumbs: BreadcrumbItem[]
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <PageTopBar title={title} breadcrumbs={breadcrumbs} />
      </section>
      <section className="container-page !px-2.5 py-5 md:!px-8 md:py-8 lg:!px-12">
        <div className="mx-auto max-w-4xl">
          <div className="surface-panel bg-surface px-5 py-5 sm:px-7 sm:py-6">
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
          </div>
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-8">{footer}</div> : null}
        </div>
      </section>
    </>
  )
}
