import { Link } from "@inertiajs/react"
import * as React from "react"

import {
  CATALOG_SORT_OPTIONS,
  SortArrowsIcon,
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
import { useSwipeClickSuppression } from "@/hooks/use-swipe-click-suppression"
import { formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { SelectOption } from "@/types"

export interface CatalogNavFilters {
  model: string
  design: string
  sort: string
}

const CATEGORY_TABS = [
  { code: "ALL", label: "Semua Produk", href: "/products/all" },
  { code: "WINDOW", label: "Jendela", href: "/products/windows" },
  { code: "DOOR", label: "Pintu", href: "/products/doors" },
  { code: "BOUVEN", label: "Boven", href: "/products/bouven" },
] as const

function categorySlug(code: string): string {
  if (code === "WINDOW") return "windows"
  if (code === "DOOR") return "doors"
  return "bouven"
}

function modelSlug(value: string): string {
  return value.toLowerCase().replace(/_/g, "-")
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
  const categoryTabsRef = React.useRef<HTMLElement>(null)
  const filterBarRef = React.useRef<HTMLDivElement>(null)
  useSwipeClickSuppression(categoryTabsRef)
  useSwipeClickSuppression(filterBarRef)

  const activeCategory = CATEGORY_TABS.find((tab) => tab.code === category)

  // Tab model untuk kategori aktif — pola "Boven Swing", "Boven Jungkit", dst.
  const modelTabs =
    activeCategory && activeCategory.code !== "ALL" && filterModels.length
      ? filterModels.map((model) => ({
          value: model.value,
          label: `${activeCategory.label} ${model.label}`,
          href: routeUrl("catalog.model", {
            category: categorySlug(activeCategory.code),
            model: modelSlug(model.value),
          }),
        }))
      : []

  return (
    <section className="border-b border-border bg-surface" aria-label="Navigasi katalog produk">
      {/* Baris 1 — Judul halaman: back, nama kategori, jumlah barang, Atur */}
      <div className="container-page flex items-center justify-between gap-3 px-5 py-3 md:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
            aria-label="Kembali"
          >
            <Icon name="arrow-left" className="size-5" aria-hidden="true" />
          </button>
          <h1 className="min-w-0 truncate text-base font-bold tracking-tight text-foreground">
            {categoryName}
          </h1>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground sm:text-sm">
          {formatNumber(total)} Barang ditemukan
          {searchQuery ? ` untuk “${searchQuery}”` : ""}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Urutkan produk"
              className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#DEDEDE] bg-background px-3 text-xs font-semibold text-foreground transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Atur
              <SortArrowsIcon className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-56 p-2">
            <DropdownMenuLabel>Urutkan</DropdownMenuLabel>
            {CATALOG_SORT_OPTIONS.map((option) => {
              const active = filters.sort === option.value
              return (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={(event) => {
                    event.preventDefault()
                    onVisit({ sort: option.value })
                  }}
                  className={cn("min-h-10 rounded-lg px-3 text-sm", active && "font-semibold")}
                >
                  <span className="flex-1">{option.label}</span>
                  {active ? (
                    <Icon name="check" className="h-4 w-4 text-primary" aria-hidden="true" />
                  ) : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Baris 2 — Tab kategori & model, frame grey (mati) / hitam (dipilih) */}
      <nav ref={categoryTabsRef} aria-label="Kategori produk" className="scrollbar-x flex gap-2 overflow-x-auto border-t border-border px-5 py-3 md:px-8 lg:px-12">
        {CATEGORY_TABS.map((tab) => {
          const active = tab.code === category
          return (
            <Link
              key={tab.code}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-lg border px-3.5 text-[13px] font-semibold transition",
                active
                  ? "border-foreground bg-foreground text-background shadow-sm"
                  : "border-border bg-surface text-foreground hover:border-foreground/50",
              )}
            >
              {tab.label}
            </Link>
          )
        })}

        {modelTabs.map((model) => {
          const active = activeModel === model.value
          return (
            <Link
              key={model.value}
              href={model.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-lg border px-3.5 text-[13px] font-semibold transition",
                active
                  ? "border-foreground bg-foreground text-background shadow-sm"
                  : "border-border bg-surface text-foreground hover:border-foreground/50",
              )}
            >
              {model.label}
            </Link>
          )
        })}

        {/* Item trailing dengan chevron — menampung kategori/model yang belum tampil */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Kategori lain"
              className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-0.5 rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-muted-foreground transition hover:border-foreground/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Kategori
              <Icon name="chevron-down" className="size-4" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={10} className="w-56 p-2">
            <DropdownMenuLabel>Kategori</DropdownMenuLabel>
            {CATEGORY_TABS.map((tab) => {
              const active = tab.code === category
              return (
                <DropdownMenuItem
                  key={tab.code}
                  asChild
                  className={cn("min-h-10 rounded-lg px-3 text-sm", active && "font-semibold")}
                >
                  <Link href={tab.href} aria-current={active ? "page" : undefined}>
                    <span className="flex-1">{tab.label}</span>
                    {active ? (
                      <Icon name="check" className="h-4 w-4 text-primary" aria-hidden="true" />
                    ) : null}
                  </Link>
                </DropdownMenuItem>
              )
            })}
            {modelTabs.length ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Model</DropdownMenuLabel>
                {modelTabs.map((model) => {
                  const active = activeModel === model.value
                  return (
                    <DropdownMenuItem
                      key={model.value}
                      asChild
                      className={cn("min-h-10 rounded-lg px-3 text-sm", active && "font-semibold")}
                    >
                      <Link href={model.href} aria-current={active ? "page" : undefined}>
                        <span className="flex-1">{model.label}</span>
                        {active ? (
                          <Icon name="check" className="h-4 w-4 text-primary" aria-hidden="true" />
                        ) : null}
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      {/* Baris 3 — Filter bar: Filter, flashsale, Kategori, Model, Desain */}
      <div className="border-b border-border bg-surface-muted">
        <div ref={filterBarRef} className="scrollbar-x flex items-center gap-2 overflow-x-auto px-5 py-2.5 md:px-8 lg:px-12">
          <Sheet open={sheetOpen} onOpenChange={onSheetOpenChange}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#DEDEDE] bg-background px-3.5 text-xs font-semibold text-foreground transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
              >
                <Icon name="sliders" className="size-4" aria-hidden="true" />
                Filter
                {activeFilterCount > 0 ? (
                  <span className="tabular-nums flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </SheetTrigger>
            {filterSheet}
          </Sheet>

          <button
            type="button"
            onClick={onToggleFlash}
            aria-pressed={isFlash}
            className={cn(
              "inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-md border px-3.5 text-xs font-semibold transition",
              isFlash
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-[#DEDEDE] bg-background text-foreground hover:border-foreground/30",
            )}
          >
            Flash Sale
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#DEDEDE] bg-background px-3.5 text-xs font-semibold text-foreground transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Kategori
                <ChevronDownIcon className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-56 p-2">
              {CATEGORY_TABS.map((tab) => {
                const active = tab.code === category
                return (
                  <DropdownMenuItem
                    key={tab.code}
                    asChild
                    className={cn("min-h-10 rounded-lg px-3 text-sm", active && "font-semibold")}
                  >
                    <Link href={tab.href}>
                      <span className="flex-1">{tab.label}</span>
                      {active ? (
                        <Icon name="check" className="h-4 w-4 text-primary" aria-hidden="true" />
                      ) : null}
                    </Link>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#DEDEDE] bg-background px-3.5 text-xs font-semibold text-foreground transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Model
                <ChevronDownIcon className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-56 p-2">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  onVisit({ model: "" })
                }}
                className={cn("min-h-10 rounded-lg px-3 text-sm", !activeModel && "font-semibold")}
              >
                <span className="flex-1">Semua Model</span>
                {!activeModel ? (
                  <Icon name="check" className="h-4 w-4 text-primary" aria-hidden="true" />
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
                    className={cn("min-h-10 rounded-lg px-3 text-sm", active && "font-semibold")}
                  >
                    <span className="flex-1">{model.label}</span>
                    {active ? (
                      <Icon name="check" className="h-4 w-4 text-primary" aria-hidden="true" />
                    ) : null}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#DEDEDE] bg-background px-3.5 text-xs font-semibold text-foreground transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Desain
                <ChevronDownIcon className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-56 p-2">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  onVisit({ design: "" })
                }}
                className={cn("min-h-10 rounded-lg px-3 text-sm", !activeDesign && "font-semibold")}
              >
                <span className="flex-1">Semua Desain</span>
                {!activeDesign ? (
                  <Icon name="check" className="h-4 w-4 text-primary" aria-hidden="true" />
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
                    className={cn("min-h-10 rounded-lg px-3 text-sm", active && "font-semibold")}
                  >
                    <span className="flex-1">{design.label}</span>
                    {active ? (
                      <Icon name="check" className="h-4 w-4 text-primary" aria-hidden="true" />
                    ) : null}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

    </section>
  )
}
