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
  subtitle: string
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
          <div className="surface-panel flex items-start gap-3.5 border-primary/20 bg-primary/[0.035] px-5 py-5 sm:gap-4 sm:px-7 sm:py-6">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:size-10">
              <span className="text-base font-bold">?</span>
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Pusat bantuan</p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-8">{footer}</div> : null}
        </div>
      </section>
    </>
  )
}
