import * as React from "react"

import { Link } from "@inertiajs/react"

import {
  CATALOG_SORT_OPTIONS,
} from "@/components/public/filter-berdasarkan-control"
import {
  categoryHrefFor,
  type CatalogCategoryLink,
} from "@/components/public/catalog-listing-sidebar"
import type { BreadcrumbItem } from "@/components/ui/breadcrumbs"
import { PageTopBar } from "@/components/public/page-top-bar"
import { Icon } from "@/components/shared/icon"
import { Input } from "@/components/ui/input"
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
  priceMin?: string
  priceMax?: string
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
  category,
  categoryName,
  total,
  searchQuery = "",
  filterModels = [],
  filterDesigns = [],
  categoryLinks = [],
  filters,
  activeModel = null,
  activeDesign = null,
  activeFilterCount = 0,
  onVisit,
  onReset,
  sheetOpen,
  onSheetOpenChange,
  filterSheet,
  isFlash = false,
  onToggleFlash,
  priceMin = "",
  priceMax = "",
  breadcrumbItems,
}: {
  category: string
  categoryName: string
  total: number
  searchQuery?: string
  filterModels?: SelectOption[]
  filterDesigns?: SelectOption[]
  categoryLinks?: CatalogCategoryLink[]
  filters: CatalogNavFilters
  activeModel?: string | null
  activeDesign?: string | null
  activeFilterCount?: number
  onVisit: (next: Partial<CatalogNavFilters>) => void
  onReset?: () => void
  sheetOpen: boolean
  onSheetOpenChange: (open: boolean) => void
  filterSheet: React.ReactNode
  basePath: string
  isFlash?: boolean
  onToggleFlash: () => void
  priceMin?: string
  priceMax?: string
  breadcrumbItems?: BreadcrumbItem[]
}) {
  const activeModelObj = filterModels.find((m) => m.value === activeModel)
  const activeModelLabel = activeModelObj ? activeModelObj.label : null
  const activeDesignObj = filterDesigns.find((d) => d.value === activeDesign)
  const activeDesignLabel = activeDesignObj ? activeDesignObj.label : null

  // Label ringkasan filter aktif di sebelah kiri baris info
  const summaryFilterLabel =
    isFlash
      ? "Flash Sale"
      : searchQuery
        ? `Pencarian: ${searchQuery}`
        : categoryName

  return (
    <section className="bg-surface py-0" aria-label="Navigasi katalog produk">
      <PageTopBar
        breadcrumbs={breadcrumbItems ?? [{ label: categoryName, href: null }]}
        title={categoryName}
      />

      {/* Baris 2 -> Filter bar 5 Slim Pills: Teks selalu utuh tanpa ellipsis */}
      <div className="border-y border-border bg-surface">
        <div className="container-page flex items-center justify-between gap-1 sm:gap-1.5 !px-2.5 md:!px-8 lg:!px-12 py-2">
          {/* Pill 1: Filter - mobile: sheet bottom; desktop: dropdown ringkas */}
          <Sheet open={sheetOpen} onOpenChange={onSheetOpenChange}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={cn(
                  "relative inline-flex h-7 flex-1 min-w-0 cursor-pointer items-center justify-center gap-0.5 sm:gap-1 rounded border px-1 sm:px-1.5 text-[11px] sm:text-xs font-normal transition sm:hidden",
                  activeFilterCount > 0
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-surface-muted text-foreground hover:border-foreground/40",
                )}
              >
                <Icon name="sliders" className="size-3 shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap">Filter</span>
                <ChevronDownIcon className="size-2 shrink-0 opacity-60" />
                {activeFilterCount > 0 ? (
                  <span
                    data-filter-count
                    className="tabular-nums absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
                  >
                    {activeFilterCount > 99 ? "99+" : activeFilterCount}
                  </span>
                ) : null}
              </button>
            </SheetTrigger>
            {filterSheet}
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "relative hidden h-7 flex-1 min-w-0 cursor-pointer items-center justify-center gap-0.5 sm:gap-1 rounded border px-1 sm:px-1.5 text-[11px] sm:text-xs font-normal transition sm:inline-flex",
                  activeFilterCount > 0
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-surface-muted text-foreground hover:border-foreground/40",
                )}
              >
                <Icon name="sliders" className="size-3 shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap">Filter</span>
                <ChevronDownIcon className="size-2 shrink-0 opacity-60" />
                {activeFilterCount > 0 ? (
                  <span
                    data-filter-count
                    className="tabular-nums absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
                  >
                    {activeFilterCount > 99 ? "99+" : activeFilterCount}
                  </span>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-80 p-3 max-h-[70vh] overflow-y-auto">
              <DropdownMenuLabel className="px-1 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Kategori
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link
                  href={categoryHrefFor("all")}
                  className={cn(
                    "min-h-8 rounded-md px-3 text-xs",
                    (!category || category === "ALL") && "font-semibold",
                  )}
                >
                  <span className="flex-1">Semua Produk</span>
                  {!category || category === "ALL" ? (
                    <Icon name="check" className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  ) : null}
                </Link>
              </DropdownMenuItem>
              {categoryLinks.map((link) => {
                const active = category === link.code
                return (
                  <DropdownMenuItem key={link.slug} asChild>
                    <Link
                      href={categoryHrefFor(link.slug)}
                      className={cn("min-h-8 rounded-md px-3 text-xs", active && "font-semibold")}
                    >
                      <span className="flex-1 capitalize">{link.label}</span>
                      {active ? (
                        <Icon name="check" className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      ) : null}
                    </Link>
                  </DropdownMenuItem>
                )
              })}

              <DropdownMenuSeparator className="my-1.5" />

              <DropdownMenuLabel className="px-1 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Model Bukaan
              </DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  onVisit({ model: "" })
                }}
                className={cn("min-h-8 rounded-md px-3 text-xs", !activeModel && "font-semibold")}
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
                    className={cn("min-h-8 rounded-md px-3 text-xs", active && "font-semibold")}
                  >
                    <span className="flex-1">{model.label}</span>
                    {active ? (
                      <Icon name="check" className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    ) : null}
                  </DropdownMenuItem>
                )
              })}

              <DropdownMenuSeparator className="my-1.5" />

              <DropdownMenuLabel className="px-1 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Desain
              </DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  onVisit({ design: "" })
                }}
                className={cn("min-h-8 rounded-md px-3 text-xs", !activeDesign && "font-semibold")}
              >
                <span className="flex-1">Semua Desain</span>
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
                    className={cn("min-h-8 rounded-md px-3 text-xs", active && "font-semibold")}
                  >
                    <span className="flex-1">{design.label}</span>
                    {active ? (
                      <Icon name="check" className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    ) : null}
                  </DropdownMenuItem>
                )
              })}

              <DropdownMenuSeparator className="my-1.5" />

              <DropdownMenuLabel className="px-1 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Rentang Harga
              </DropdownMenuLabel>
              <div className="grid grid-cols-2 gap-2 px-1 pt-1">
                <label className="grid gap-1 text-[11px] text-muted-foreground">
                  Minimum
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    defaultValue={priceMin ?? ""}
                    data-price-min
                    placeholder="Rp0"
                    className="h-7 text-xs"
                  />
                </label>
                <label className="grid gap-1 text-[11px] text-muted-foreground">
                  Maksimum
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    defaultValue={priceMax ?? ""}
                    data-price-max
                    placeholder="Tanpa Batas"
                    className="h-7 text-xs"
                  />
                </label>
              </div>
              <div className="mt-2 flex items-center gap-2 px-1">
                <button
                  type="button"
                  onClick={() => {
                    const min = (document.querySelector("[data-price-min]") as HTMLInputElement | null)
                      ?.value ?? ""
                    const max = (document.querySelector("[data-price-max]") as HTMLInputElement | null)
                      ?.value ?? ""
                    onVisit({ priceMin: min, priceMax: max })
                  }}
                  className="inline-flex h-7 flex-1 items-center justify-center rounded-md bg-foreground px-3 text-xs font-medium text-background transition hover:opacity-85"
                >
                  Terapkan Harga
                </button>
                {onReset ? (
                  <button
                    type="button"
                    onClick={onReset}
                    className="inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-border px-3 text-xs font-medium text-foreground transition hover:border-foreground/30"
                  >
                    Reset
                  </button>
                ) : null}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Pill 2: Flash Sale (Ikon rapat dengan teks "Flash", teks utuh) */}
          <button
            type="button"
            onClick={onToggleFlash}
            aria-pressed={isFlash}
            className={cn(
              "inline-flex h-7 flex-1 min-w-0 cursor-pointer items-center justify-center gap-0.5 sm:gap-1 rounded border px-1 sm:px-1.5 text-[11px] sm:text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              isFlash
                ? "border-primary bg-primary text-white shadow-sm ring-2 ring-primary ring-offset-1 hover:bg-primary-hover"
                : "border-border bg-surface-muted text-foreground hover:border-foreground/40",
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
                    ? "border-foreground/50 bg-surface-muted text-foreground font-medium"
                    : "border-border bg-background text-foreground/80 hover:text-foreground",
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
                className={cn("min-h-8 rounded-md px-3 text-xs", !activeModel && "font-semibold")}
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
                    className={cn("min-h-8 rounded-md px-3 text-xs", active && "font-semibold")}
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

          {/* Pill 4: Desain */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-7 flex-1 min-w-0 cursor-pointer items-center justify-center gap-0.5 sm:gap-1 rounded border px-1 sm:px-1.5 text-[11px] sm:text-xs font-normal transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  activeDesign
                    ? "border-foreground/50 bg-surface-muted text-foreground font-medium"
                    : "border-border bg-background text-foreground/80 hover:text-foreground",
                )}
              >
                <span className="truncate">{activeDesignLabel || "Desain"}</span>
                <ChevronDownIcon className="size-2 shrink-0 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-56 p-2">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  onVisit({ design: "" })
                }}
                className={cn("min-h-8 rounded-md px-3 text-xs", !activeDesign && "font-semibold")}
              >
                <span className="flex-1">Semua Desain</span>
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
                    className={cn("min-h-8 rounded-md px-3 text-xs", active && "font-semibold")}
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
                className="inline-flex h-7 flex-1 min-w-0 cursor-pointer items-center justify-center gap-0.5 sm:gap-1 rounded border border-border bg-background px-1 sm:px-1.5 text-[11px] sm:text-xs font-normal text-foreground/80 transition hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                    className={cn("min-h-8 rounded-md px-3 text-xs", active && "font-semibold")}
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

      {/* Baris 3 -> Ringkasan Filter & Jumlah Barang (tanpa garis, pola padding standar) */}
      <div className="container-page !px-2.5 md:!px-8 lg:!px-12 pt-2 pb-1.5 sm:pt-2.5 sm:pb-2">
        <div className="flex items-center justify-between gap-2 text-xs font-normal">
          <span className="truncate font-medium text-foreground">{summaryFilterLabel}</span>
          <span className="shrink-0 text-right text-muted-foreground">
            {formatNumber(total)} Barang ditemukan
          </span>
        </div>
      </div>
    </section>
  )
}

