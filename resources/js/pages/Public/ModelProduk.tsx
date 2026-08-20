import { Head, router } from "@inertiajs/react"
import * as React from "react"

import { SortArrowsIcon } from "@/components/public/filter-berdasarkan-control"
import { PageHeader } from "@/components/public/page-header"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/ui/empty-state"
import { ModelCategoryCard } from "@/components/public/model-category-card"
import PublicLayout from "@/layouts/public-layout"
import { formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { ModelCardData } from "@/types"

interface ModelProdukProps {
  models: ModelCardData[]
  activeSort?: "admin" | "latest" | "oldest"
}

const SORT_OPTIONS = [
  { value: "latest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
] as const

/** Tombol "Urutkan" + menu urutan: default urutan admin, terbaru, terlama. */
function SortMenu({ value, onChange }: { value: string; onChange: (value: string) => void }) {
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
          // Default (urutan admin) sengaja tanpa opsi terpilih; checkmark hanya
          // untuk Terbaru/Terlama.
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

export default function ModelProduk({ models = [], activeSort = "admin" }: ModelProdukProps) {
  const [sort, setSort] = React.useState<string>(activeSort)

  React.useEffect(() => {
    // Inertia navigation can replace the active sort while this page instance remains mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSort(activeSort)
  }, [activeSort])

  function selectSort(value: string) {
    setSort(value)
    router.get(
      routeUrl("catalog.index"),
      value ? { sort: value } : {},
      { preserveState: true, preserveScroll: true, replace: true },
    )
  }

  const totalCount = models.reduce((sum, model) => sum + (Number(model.count) || 0), 0)

  return (
    <PublicLayout>
      <Head title="Semua Model Produk">
        <meta
          name="description"
          content="Bandingkan model jendela, pintu, dan boven aluminium berdasarkan jenis bukaan dan desain."
        />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden md:block py-2 !px-2.5 md:!px-8 lg:!px-12">
          <Breadcrumbs
            items={[
              { label: "Home", href: routeUrl("home") },
              { label: "Semua Model Produk" },
            ]}
          />
        </div>
        <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
          <PageHeader title="Semua Model Produk" container={false} />

          <div className="flex items-center justify-between gap-4 pt-2 pb-1.5 sm:pt-2.5 sm:pb-2">
            <p className="text-xs text-muted-foreground sm:text-sm">
              {formatNumber(totalCount)} model produk ditemukan
            </p>
            <SortMenu value={sort} onChange={selectSort} />
          </div>
        </div>
      </section>

      <section className="container-page !px-2.5 md:!px-8 lg:!px-12 py-5 md:py-8">
        {models.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {models.map((model) => (
              <ModelCategoryCard key={`${model.category}-${model.model}`} model={model} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="funnel"
            title="Belum ada model yang cocok"
            description="Model produk belum tersedia pada katalog aktif."
          />
        )}
      </section>
    </PublicLayout>
  )
}
