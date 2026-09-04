import * as React from "react"

import {
  AppliedFiltersCard,
  FilterSidebar,
  FilterSidebarSection,
} from "@/components/public/filter-sidebar"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { Link } from "@inertiajs/react"
import { routeUrl } from "@/lib/routes"
import type { SelectOption } from "@/types"

export interface CatalogCategoryLink {
  slug: string
  code: string
  label: string
}

export function categoryHrefFor(slug: string): string {
  return slug === "all" ? routeUrl("catalog.all") : routeUrl("catalog.category", { category: slug })
}

export function DesignFilterOptions({
  name,
  designs,
  activeDesign,
  onSelect,
}: {
  name: string
  designs: SelectOption[]
  activeDesign: string | null
  onSelect: (value: string | null) => void
}) {
  const Item = ({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-8 w-full items-center justify-center gap-1 rounded border px-1.5 text-xs font-normal transition sm:min-h-7",
        selected
          ? "border-foreground/50 bg-surface-muted font-medium text-foreground"
          : "border-border bg-background text-foreground/80 hover:text-foreground",
      )}
    >
      <span className="truncate">{children}</span>
      {selected ? <Icon name="check" className="size-3 shrink-0 text-primary" aria-hidden="true" /> : null}
    </button>
  )

  return (
    <div className="flex flex-row flex-wrap gap-1.5" role="listbox" aria-label={name}>
      <Item selected={!activeDesign} onClick={() => onSelect(null)}>
        Semua Desain
      </Item>
      {designs.map((design) => (
        <Item
          key={design.value}
          selected={activeDesign === design.value}
          onClick={() => onSelect(design.value)}
        >
          {design.label}
        </Item>
      ))}
    </div>
  )
}

export function ModelFilterOptions({
  name,
  models,
  activeModel,
  onSelect,
}: {
  name: string
  models: SelectOption[]
  activeModel: string | null
  onSelect: (value: string | null) => void
}) {
  const Item = ({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-8 w-full items-center justify-center gap-1 rounded border px-1.5 text-xs font-normal transition sm:min-h-7",
        selected
          ? "border-foreground/50 bg-surface-muted font-medium text-foreground"
          : "border-border bg-background text-foreground/80 hover:text-foreground",
      )}
    >
      <span className="truncate">{children}</span>
      {selected ? <Icon name="check" className="size-3 shrink-0 text-primary" aria-hidden="true" /> : null}
    </button>
  )

  return (
    <div className="flex flex-row flex-wrap gap-1.5" role="listbox" aria-label={name}>
      <Item selected={!activeModel} onClick={() => onSelect(null)}>
        Semua Model
      </Item>
      {models.map((model) => (
        <Item
          key={model.value}
          selected={activeModel === model.value}
          onClick={() => onSelect(model.value)}
        >
          {model.label}
        </Item>
      ))}
    </div>
  )
}


export function CategoryFilterOptions({
  categoryLinks,
  activeCategory,
  fieldSuffix,
}: {
  categoryLinks: CatalogCategoryLink[]
  activeCategory?: string | null
  fieldSuffix?: string
}) {
  const options = categoryLinks.length > 0
    ? [{ slug: "all", code: "ALL", label: "Semua Produk" }, ...categoryLinks]
    : []

  return (
    <nav aria-label="Kategori" className="flex flex-col">
      {options.map((option) => {
        const active =
          (option.code === "ALL" && (!activeCategory || activeCategory === "ALL")) ||
          (option.code !== "ALL" && activeCategory === option.code)
        return (
          <Link
            key={option.slug}
            href={categoryHrefFor(option.slug)}
            className="flex min-h-10 items-center justify-between py-1.5 text-sm capitalize text-foreground hover:text-primary"
            aria-current={active ? "page" : undefined}
          >
            <span className={active ? "font-semibold text-primary" : undefined}>{option.label}</span>
            {active ? (
              <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

export interface CatalogListingFilters {
  model: string
  design: string
  priceMin: string
  priceMax: string
}

function formatPriceChip(min: string, max: string): string {
  if (min && max) return `Rp${min} – Rp${max}`
  if (min) return `Min Rp${min}`
  if (max) return `Max Rp${max}`
  return "Rentang Harga"
}

export function CatalogProductListingSidebar({
  filterModels,
  filterDesigns,
  filters,
  activeModel,
  activeDesign,
  priceMin,
  priceMax,
  variant = "live",
  onFiltersChange,
  onClearAll,
  onApplyPrice,
  className,
  fieldSuffix = "sidebar",
  categoryLinks = [],
  activeCategory,
}: {
  filterModels: SelectOption[]
  filterDesigns: SelectOption[]
  filters: CatalogListingFilters
  activeModel: string | null
  activeDesign: string | null
  priceMin: number | null
  priceMax: number | null
  variant?: "live" | "draft"
  onFiltersChange: (next: Partial<CatalogListingFilters>) => void
  onClearAll: () => void
  onApplyPrice?: () => void
  className?: string
  fieldSuffix?: string
  categoryLinks?: CatalogCategoryLink[]
  activeCategory?: string | null
}) {
  const activeModelLabel =
    filterModels.find((model) => model.value === activeModel)?.label ?? null
  const activeDesignLabel =
    filterDesigns.find((design) => design.value === activeDesign)?.label ?? null

  const chips: { id: string; label: string }[] = []
  if (activeModel && activeModelLabel) {
    chips.push({ id: "model", label: activeModelLabel })
  }
  if (activeDesign && activeDesignLabel) {
    chips.push({ id: "design", label: activeDesignLabel })
  }
  if (priceMin || priceMax) {
    chips.push({
      id: "price",
      label: formatPriceChip(priceMin?.toString() ?? "", priceMax?.toString() ?? ""),
    })
  }

  function removeChip(id: string) {
    if (id === "model") onFiltersChange({ model: "" })
    if (id === "design") onFiltersChange({ design: "" })
    if (id === "price") onFiltersChange({ priceMin: "", priceMax: "" })
  }

  function selectModel(value: string | null) {
    onFiltersChange({ model: value ?? "" })
  }

  function selectDesign(value: string | null) {
    onFiltersChange({ design: value ?? "" })
  }

  return (
    <FilterSidebar className={className}>
      <AppliedFiltersCard chips={chips} onRemove={removeChip} onClearAll={onClearAll} />

      {categoryLinks.length > 0 ? (
        <FilterSidebarSection title="Kategori">
          <CategoryFilterOptions
            categoryLinks={categoryLinks}
            activeCategory={activeCategory}
            fieldSuffix={fieldSuffix}
          />
        </FilterSidebarSection>
      ) : null}

      {filterModels.length ? (
        <FilterSidebarSection title="Model Bukaan" subtitle={activeModelLabel}>
          <ModelFilterOptions
            name={`catalog-model-${fieldSuffix}`}
            models={filterModels}
            activeModel={activeModel}
            onSelect={selectModel}
          />
        </FilterSidebarSection>
      ) : null}

      {filterDesigns.length ? (
        <FilterSidebarSection title="Desain" subtitle={activeDesignLabel}>
          <DesignFilterOptions
            name={`catalog-design-${fieldSuffix}`}
            designs={filterDesigns}
            activeDesign={activeDesign}
            onSelect={selectDesign}
          />
        </FilterSidebarSection>
      ) : null}

      <FilterSidebarSection title="Rentang Harga" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <Field id={`price-min-${fieldSuffix}`} label="Minimum">
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              value={filters.priceMin}
              onChange={(event) => onFiltersChange({ priceMin: event.target.value })}
              placeholder="Rp0"
            />
          </Field>
          <Field id={`price-max-${fieldSuffix}`} label="Maksimum">
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              value={filters.priceMax}
              onChange={(event) => onFiltersChange({ priceMax: event.target.value })}
              placeholder="Tanpa Batas"
            />
          </Field>
        </div>
        {variant === "live" ? (
          <Button type="button" variant="secondary" className="mt-3 w-full" onClick={onApplyPrice}>
            Terapkan Harga
          </Button>
        ) : null}
      </FilterSidebarSection>

    </FilterSidebar>
  )
}
