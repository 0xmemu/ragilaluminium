import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export function FilterSidebar({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn("flex flex-col gap-4", className)}>{children}</div>
}

export function FilterOptionChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "min-h-10 rounded-md border px-3.5 text-xs font-semibold transition",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-surface text-foreground hover:border-foreground/25 hover:bg-muted/40",
      )}
    >
      {children}
    </button>
  )
}

export function FilterSheetContent({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <SheetContent
      side="bottom"
      className={cn(
        "safe-bottom flex max-h-[88dvh] flex-col gap-0 overflow-hidden rounded-t-2xl border-t p-0 shadow-[0_-12px_40px_rgba(10,0,0,0.14)]",
        className,
      )}
    >
      <div className="flex shrink-0 justify-center pt-3" aria-hidden="true">
        <span className="h-1 w-10 rounded-full bg-border" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-3">
        <SheetTitle className="font-display text-lg font-bold tracking-tight">{title}</SheetTitle>
        {description ? (
          <SheetDescription className="mt-1.5 text-sm text-muted-foreground">
            {description}
          </SheetDescription>
        ) : null}
        <div className="mt-4">{children}</div>
      </div>

      {footer ? (
        <div className="shrink-0 border-t border-border bg-surface px-5 py-4 shadow-[0_-8px_24px_rgba(10,0,0,0.06)]">
          {footer}
        </div>
      ) : null}
    </SheetContent>
  )
}

export function FilterSidebarCard({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-surface p-4 shadow-[0_2px_4px_rgba(10,0,0,0.06),0_12px_28px_rgba(10,0,0,0.16)]",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function FilterSidebarSection({
  title,
  subtitle,
  defaultOpen = true,
  children,
}: {
  title: string
  subtitle?: string | null
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  const panelId = React.useId()

  return (
    <FilterSidebarCard>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="text-sm font-bold capitalize text-foreground">{title}</span>
          {subtitle ? (
            <span className="truncate text-sm text-muted-foreground">({subtitle})</span>
          ) : null}
        </span>
        <Icon
          name="caret-down"
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-[260ms] motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div id={panelId} className="mt-4">
          {children}
        </div>
      ) : null}
    </FilterSidebarCard>
  )
}

export function AppliedFiltersCard({
  chips,
  onRemove,
  onClearAll,
}: {
  chips: { id: string; label: string }[]
  onRemove: (id: string) => void
  onClearAll: () => void
}) {
  if (!chips.length) return null

  return (
    <FilterSidebarCard>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold capitalize text-foreground">Filter Terpasang</p>
        <button
          type="button"
          onClick={onClearAll}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Hapus semua
        </button>
      </div>
      <ul className="mt-4 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.id}>
            <span className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface-muted px-3 text-sm text-foreground">
              {chip.label}
              <button
                type="button"
                onClick={() => onRemove(chip.id)}
                className="inline-flex size-6 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label={`Hapus filter ${chip.label}`}
              >
                <Icon name="x" className="h-4 w-4" aria-hidden="true" />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </FilterSidebarCard>
  )
}
