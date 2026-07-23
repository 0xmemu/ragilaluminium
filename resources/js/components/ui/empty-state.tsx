import type { ReactNode } from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon = "package",
  title,
  description,
  action,
  className,
}: {
  icon?: string
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted/55 p-8 text-center md:p-12",
        className,
      )}
    >
      <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-md bg-surface text-primary shadow-sm">
        <Icon name={icon} className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold text-foreground sm:text-xl">{title}</h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </section>
  )
}

export function ErrorState({
  title = "Konten belum dapat dimuat",
  description = "Muat ulang halaman atau coba kembali beberapa saat lagi.",
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <EmptyState
      icon="warning"
      title={title}
      description={description}
      action={action}
      className="border-destructive/25 bg-destructive/5"
    />
  )
}
