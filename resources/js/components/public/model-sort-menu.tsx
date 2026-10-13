import * as React from "react"

import { SortArrowsIcon } from "@/components/public/filter-berdasarkan-control"
import { Icon } from "@/components/shared/icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const SORT_OPTIONS = [
  { value: "latest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
] as const

/** Tombol "Urutkan" + menu urutan: default urutan admin, terbaru, terlama. */
export function SortMenu({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const selectedLabel = SORT_OPTIONS.find((option) => option.value === value)?.label
  const hasSelection = selectedLabel !== undefined

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Urutkan model produk"
          aria-haspopup="listbox"
          aria-expanded={open}
          className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md px-1 text-xs font-medium text-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="truncate">{hasSelection ? selectedLabel : "Urutkan"}</span>
          <SortArrowsIcon className="size-4 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-xl border border-border bg-surface p-2 shadow-[0_8px_28px_rgba(10,0,0,0.12)]"
      >
        <DropdownMenuLabel className="px-2 pb-1.5 pt-0.5">Urutkan</DropdownMenuLabel>
        {SORT_OPTIONS.map((option) => {
          const selected = option.value === value
          return (
            <DropdownMenuItem
              key={option.value || "default"}
              onSelect={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={cn(
                "min-h-10 justify-between rounded-lg px-2.5",
                selected ? "bg-accent/60 font-semibold text-foreground" : "text-foreground",
              )}
            >
              <span>{option.label}</span>
              {selected ? (
                <Icon name="check" className="size-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <span className="size-4 shrink-0" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}