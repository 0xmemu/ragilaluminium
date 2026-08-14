import * as React from "react"

import {
  CATALOG_SORT_OPTIONS,
} from "@/components/public/filter-berdasarkan-control"
import { Icon } from "@/components/shared/icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetTrigger } from "@/components/ui/sheet"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { SelectOption } from "@/types"

export interface CatalogNavFilters {
  model: string
  design: string
  sort: string
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 9L12 15L18 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CatalogNav({
  categoryName,
  total,
  searchQuery = "",
  filterModels = [],
  filterDesigns = [],
  filters,
  activeModel = null,
  activeDesign = null,
  activeFilterCount = 0,
  onVisit,
  sheetOpen,
  onSheetOpenChange,
  filterSheet,
  isFlash = false,
  onToggleFlash,
}: {
  category: string
  categoryName: string
  total: number
  searchQuery?: string
  filterModels?: SelectOption[]
  filterDesigns?: SelectOption[]
  filters: CatalogNavFilters
  activeModel?: string | null
  activeDesign?: string | null
  activeFilterCount?: number
  onVisit: (next: Partial<CatalogNavFilters>) => void
  sheetOpen: boolean
  onSheetOpenChange: (open: boolean) => void
  filterSheet: React.ReactNode
  basePath: string
  isFlash?: boolean
  onToggleFlash: () => void
}) {
  const activeModelObj = filterModels.find((m) => m.value === activeModel)
  const activeModelLabel = activeModelObj ? activeModelObj.label : null
  const activeDesignObj = filterDesigns.find((d) => d.value === activeDesign)
  const activeDesignLabel = activeDesignObj ? activeDesignObj.label : null

  // Label ringkasan filter aktif di sebelah kiri baris info
  const summaryFilterLabel =
    activeModelLabel
      ? `${categoryName} ${activeModelLabel}`
      : activeDesignLabel
        ? activeDesignLabel
        : isFlash
          ? "Flash Sale"
          : searchQuery
            ? `Pencarian: ${searchQuery}`
            : categoryName

  return (
    <section className="bg-surface" aria-label="Navigasi katalog produk">
      {/* Baris 1 ??? Judul halaman: Back button & Category Name */}
      <div className="container-page flex items-center justify-between gap-3 px-3 sm:px-5 md:px-8 lg:px-12 py-2.5 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="-ml-2 flex size-10 shrink-0 items-center justify-center text-foreground hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Kembali"
          >
            <Icon name="arrow-left" className="size-5" aria-hidden="true" />
          </button>
          <h1 className="min-w-0 truncate text-base font-bold tracking-tight text-foreground">
            {categoryName}
          </h1>
        </div>
      </div>

      {/* Baris 2 ??? Filter bar 5 Slim Pills: Teks selalu utuh tanpa ellipsis */}
      <div className="border-y border-border bg-surface">
        <div className="container-page flex items-center justify-between gap-1 sm:gap-1.5 px-3 sm:px-5 md:px-8 lg:px-12 py-2">
          {/* Pill 1: Filter */}
          <Sheet open={sheetOpen} onOpenChange={onSheetOpenChange}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-7 flex-1 min-w-0 cursor-pointer items-center justify-center gap-0.5 sm:gap-1 rounded border px-1 sm:px-1.5 text-[11px] sm:text-xs font-normal transition",
                  activeFilterCount > 0
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-[#F4F4F4] text-foreground hover:border-foreground/40",
                )}
              >
                <Icon name="sliders" className="size-3 shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap">Filter</span>
                <ChevronDownIcon className="size-2 shrink-0 opacity-60" />
                {activeFilterCount > 0 ? (
                  <span className="tabular-nums flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </SheetTrigger>
            {filterSheet}
          </Sheet>

          {/* Pill 2: Flash Sale (Ikon rapat dengan teks "Flash", teks utuh) */}
          <button
            type="button"
            onClick={onToggleFlash}
            aria-pressed={isFlash}
            className={cn(
              "inline-flex h-7 flex-1 min-w-0 cursor-pointer items-center justify-center gap-0.5 sm:gap-1 rounded border px-1 sm:px-1.5 text-[11px] sm:text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c20000] focus-visible:ring-offset-2",
              isFlash
                ? "border-[#c20000] bg-[#c20000] text-white shadow-sm ring-2 ring-[#c20000] ring-offset-1 hover:bg-[#a80000]"
                : "border-border bg-[#F4F4F4] text-foreground hover:border-foreground/40",
            )}
          >
            <Icon
              name="lightning"
              weight="fill"
              className={cn("size-3 shrink-0", isFlash ? "text-white fill-white" : "text-foreground fill-foreground")}
              aria-hidden="true"
            />
            <span className="whitespace-nowrap sm:hidden">Flash</span>
            <span className="hidden sm:inline whitespace-nowrap">Flash Sale</span>
          </button>

          {/* Pill 3: Model */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-7 flex-1 min-w-0 cursor-pointer items-center justify-center gap-0.5 sm:gap-1 rounded border px-1 sm:px-1.5 text-[11px] sm:text-xs font-normal transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  activeModel
                    ? "border-foreground/50 bg-[#F4F4F4] text-foreground font-medium"
                    : "border-[#DEDEDE] bg-background text-foreground/80 hover:text-foreground",
                )}
              >
                <span className="truncate">{activeModelLabel || "Model"}</span>
                <ChevronDownIcon className="size-2 shrink-0 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-56 p-2">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  onVisit({ model: "" })
                }}
                className={cn("min-h-9 rounded-md px-3 text-xs", !activeModel && "font-semibold")}
              >
                <span className="flex-1">Semua Model</span>
                {!activeModel ? (
                  <Icon name="check" className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                ) : null}
              </DropdownMenuItem>
              {filterModels.map((model) => {
                const active = activeModel === model.value
                return (
                  <DropdownMenuItem
                    key={model.value}
                    onSelect={(event) => {
                      event.preventDefault()
                      onVisit({ model: model.value })
                    }}
                    className={cn("min-h-9 rounded-md px-3 text-xs", active && "font-semibold")}
                  >
                    <span className="flex-1">{model.label}</span>
                    {active ? (
                      <Icon name="check" className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    ) : null}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Pill 4: Ukuran / Desain */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-7 flex-1 min-w-0 cursor-pointer items-center justify-center gap-0.5 sm:gap-1 rounded border px-1 sm:px-1.5 text-[11px] sm:text-xs font-normal transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  activeDesign
                    ? "border-foreground/50 bg-[#F4F4F4] text-foreground font-medium"
                    : "border-[#DEDEDE] bg-background text-foreground/80 hover:text-foreground",
                )}
              >
                <span className="truncate">{activeDesignLabel || "Ukuran"}</span>
                <ChevronDownIcon className="size-2 shrink-0 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-56 p-2">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  onVisit({ design: "" })
                }}
                className={cn("min-h-9 rounded-md px-3 text-xs", !activeDesign && "font-semibold")}
              >
                <span className="flex-1">Semua Ukuran</span>
                {!activeDesign ? (
                  <Icon name="check" className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                ) : null}
              </DropdownMenuItem>
              {filterDesigns.map((design) => {
                const active = activeDesign === design.value
                return (
                  <DropdownMenuItem
                    key={design.value}
                    onSelect={(event) => {
                      event.preventDefault()
                      onVisit({ design: design.value })
                    }}
                    className={cn("min-h-9 rounded-md px-3 text-xs", active && "font-semibold")}
                  >
                    <span className="flex-1">{design.label}</span>
                    {active ? (
                      <Icon name="check" className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    ) : null}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Pill 5: Atur (Sort) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Urutkan produk"
                className="inline-flex h-7 flex-1 min-w-0 cursor-pointer items-center justify-center gap-0.5 sm:gap-1 rounded border border-[#DEDEDE] bg-background px-1 sm:px-1.5 text-[11px] sm:text-xs font-normal text-foreground/80 transition hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="whitespace-nowrap">Atur</span>
                <ChevronDownIcon className="size-2 shrink-0 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-56 p-2">
              <DropdownMenuLabel className="text-xs">Urutkan</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CATALOG_SORT_OPTIONS.map((option) => {
                const active = filters.sort === option.value
                return (
                  <DropdownMenuItem
                    key={option.value}
                    onSelect={(event) => {
                      event.preventDefault()
                      onVisit({ sort: option.value })
                    }}
                    className={cn("min-h-9 rounded-md px-3 text-xs", active && "font-semibold")}
                  >
                    <span className="flex-1">{option.label}</span>
                    {active ? (
                      <Icon name="check" className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    ) : null}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Baris 3 ??? Ringkasan Filter & Jumlah Barang + Garis Inset Bawah */}
      <div className="container-page px-3 sm:px-5 md:px-8 lg:px-12 pt-2.5 pb-0">
        <div className="flex items-center justify-between gap-2 text-xs font-normal">
          <span className="truncate font-medium text-foreground">{summaryFilterLabel}</span>
          <span className="shrink-0 text-right text-muted-foreground">
            {formatNumber(total)} Barang ditemukan
          </span>
        </div>
        <div className="mt-2.5 border-b border-[#E5E7EB]" />
      </div>
    </section>
  )
}

