import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/** Compact action cluster for table/card rows — wraps cleanly, never overlaps. */
export function RowActions({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-wrap items-center justify-end gap-1",
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Overflow menu for secondary row actions (keeps rows stable on narrow viewports). */
export function RowActionsMenu({
  label = "Lainnya",
  children,
  align = "end",
}: {
  label?: string
  children: React.ReactNode
  align?: "start" | "center" | "end"
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary" size="xs" aria-label={label}>
          <Icon name="dots-three" className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[10rem]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Text/link trigger styled like a compact row action (for ConfirmAction). */
export const rowActionTextClass =
  "inline-flex h-7 items-center justify-center px-2 text-xs font-medium transition hover:underline disabled:pointer-events-none disabled:opacity-50"
