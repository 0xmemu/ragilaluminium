import { Link } from "@inertiajs/react"
import * as React from "react"

import { ConsultationWhatsAppCard } from "@/components/public/consultation-whatsapp-card"
import {
  AppliedFiltersCard,
  FilterSidebar,
  FilterSidebarSection,
} from "@/components/public/filter-sidebar"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { routeUrl, withQuery } from "@/lib/routes"
import type { SelectOption } from "@/types"

export const CATALOG_CATEGORY_LINKS = [
  {
    label: "Semua Produk",
    href: routeUrl("catalog.all"),
  },
  { label: "Jendela", href: routeUrl("catalog.category", { category: "windows" }) },
  { label: "Pintu", href: routeUrl("catalog.category", { category: "doors" }) },
  { label: "Boven", href: routeUrl("catalog.category", { category: "bouven" }) },
  {
    label: "Paling Banyak Dipesan",
    href: withQuery(routeUrl("catalog.all"), { sort: "popular" }),
  },
] as const

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
  return (
    <fieldset className="space-y-1">
      <legend className="sr-only">Filter desain</legend>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-1 text-sm hover:bg-accent">
        <input
          type="radio"
          name={name}
          value=""
          checked={!activeDesign}
          onChange={() => onSelect(null)}
          className="h-4 w-4 accent-primary"
        />
        Semua Desain
      </label>
      {designs.map((design) => (
        <label
          key={design.value}
          className="flex min-h-11 cursor-pointer items-center gap-3 px-1 text-sm hover:bg-accent"
        >
          <input
            type="radio"
            name={name}
            value={design.value}
            checked={activeDesign === design.value}
            onChange={() => onSelect(design.value)}
            className="h-4 w-4 accent-primary"
          />
          {design.label}
        </label>
      ))}
    </fieldset>
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
  return (
    <fieldset className="space-y-1">
      <legend className="sr-only">Filter model bukaan</legend>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-1 text-sm hover:bg-accent">
        <input
          type="radio"
          name={name}
          value=""
          checked={!activeModel}
          onChange={() => onSelect(null)}
          className="h-4 w-4 accent-primary"
        />
        Semua Model
      </label>
      {models.map((model) => (
        <label
          key={model.value}
          className="flex min-h-11 cursor-pointer items-center gap-3 px-1 text-sm hover:bg-accent"
        >
          <input
            type="radio"
            name={name}
            value={model.value}
            checked={activeModel === model.value}
            onChange={() => onSelect(model.value)}
            className="h-4 w-4 accent-primary"
          />
          {model.label}
        </label>
      ))}
    </fieldset>
  )
}

export function CategoryFilterNav({
  currentHref,
}: {
  currentHref?: string | null
}) {
  return (
    <nav aria-label="Kategori" className="flex flex-col">
      {CATALOG_CATEGORY_LINKS.map((link) => {
        const active = currentHref === link.href

        return (
          <Link
            key={link.href}
            href={link.href}
            className="flex min-h-10 items-center justify-between py-1.5 text-sm capitalize text-foreground hover:text-primary"
            aria-current={active ? "page" : undefined}
          >
            <span className={active ? "font-semibold text-primary" : undefined}>{link.label}</span>
            <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        )
      })}
    </nav>
  )
}

export function ModelProdukListingSidebar({
  filterDesigns,
  activeDesign,
  onSelectDesign,
  onClearDesign,
  className,
}: {
  filterDesigns: SelectOption[]
  activeDesign: string | null
  onSelectDesign: (value: string | null) => void
  onClearDesign: () => void
  className?: string
}) {
  const activeDesignLabel =
    filterDesigns.find((design) => design.value === activeDesign)?.label ?? null

  return (
    <FilterSidebar className={className}>
      <AppliedFiltersCard
        chips={
          activeDesign && activeDesignLabel
            ? [{ id: activeDesign, label: activeDesignLabel }]
            : []
        }
        onRemove={() => onClearDesign()}
        onClearAll={onClearDesign}
      />

      {filterDesigns.length ? (
        <FilterSidebarSection title="Desain" subtitle={activeDesignLabel}>
          <DesignFilterOptions
            name="model-design"
            designs={filterDesigns}
            activeDesign={activeDesign}
            onSelect={onSelectDesign}
          />
        </FilterSidebarSection>
      ) : null}

      <FilterSidebarSection title="Kategori">
        <CategoryFilterNav />
      </FilterSidebarSection>

      <ConsultationWhatsAppCard source="model_produk" />
    </FilterSidebar>
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
  currentHref,
  consultationSource = "catalog",
  variant = "live",
  onFiltersChange,
  onClearAll,
  onApplyPrice,
  className,
  fieldSuffix = "sidebar",
}: {
  filterModels: SelectOption[]
  filterDesigns: SelectOption[]
  filters: CatalogListingFilters
  activeModel: string | null
  activeDesign: string | null
  priceMin: number | null
  priceMax: number | null
  currentHref?: string | null
  consultationSource?: string
  variant?: "live" | "draft"
  onFiltersChange: (next: Partial<CatalogListingFilters>) => void
  onClearAll: () => void
  onApplyPrice?: () => void
  className?: string
  fieldSuffix?: string
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

      <FilterSidebarSection title="Kategori">
        <CategoryFilterNav currentHref={currentHref} />
      </FilterSidebarSection>

      <ConsultationWhatsAppCard source={consultationSource} />
    </FilterSidebar>
  )
}
