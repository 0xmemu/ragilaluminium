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
        "flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface p-8 text-center md:p-12",
        className,
      )}
    >
      <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon name={icon} className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1.5 max-w-md text-xs leading-5 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
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
