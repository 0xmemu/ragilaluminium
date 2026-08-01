import * as React from "react"

import { Card } from "@/components/admin/ui/card"
import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

/**
 * SectionCard — pola standar "kartu ber-section" untuk seluruh admin:
 * header (judul + deskripsi + aksi opsional) dengan hairline divider, lalu konten.
 * Membuat banyak kartu tetap rapi dan konsisten.
 */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  icon,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Default "p-5". Gunakan "p-0" untuk list/table full-bleed. */
  contentClassName?: string
  icon?: string
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon name={icon} className="size-3.5" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </Card>
  )
}
