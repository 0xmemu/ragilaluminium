import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { SortArrowsIcon } from "@/components/public/filter-berdasarkan-control"
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
import { ResponsiveImage } from "@/components/ui/responsive-image"
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

/** Kartu kategori x model: gambar + badge jumlah produk + meta model. */
function ModelCategoryCard({ model }: { model: ModelCardData }) {
  const href = model.detail_href?.trim() || model.href
  const designCount = model.designs?.length ?? 0

  return (
    <article className="group overflow-hidden rounded-[5px] border border-[#dee3e0] bg-white transition-colors duration-200 hover:border-[#b9c2bd]">
      <Link
        href={href}
        prefetch
        className="flex h-full min-w-0 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-[#f7f8f8]">
          <ResponsiveImage
            src={model.image}
            alt={model.title}
            className="transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <span className="absolute bottom-2 left-2 rounded-[4px] bg-[#c20000] px-2 py-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
            {formatNumber(Number(model.count) || 0)} produk
          </span>
        </div>

        <div className="flex shrink-0 flex-col gap-1.5 p-2.5">
          <h3 className="line-clamp-2 shrink-0 text-[13px] font-semibold leading-snug text-[#333333]">
            {model.title}
          </h3>
          <div className="flex-1" aria-hidden="true" />
          <div className="h-px w-full bg-[#dee3e0]" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] leading-snug text-[#666666]">
              {designCount > 0 ? `${formatNumber(designCount)} model produk` : "Model katalog"}
            </span>
            <Icon name="arrow-up-right" className="size-3.5 shrink-0 text-[#333333]" aria-hidden="true" />
          </div>
        </div>
      </Link>
    </article>
  )
}

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
          className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md px-1 text-xs font-medium text-[#333333] transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="truncate">{hasSelection ? selectedLabel : "Urutkan"}</span>
          <SortArrowsIcon className="size-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-xl border border-[#DEDEDE] bg-surface p-2 shadow-[0_8px_28px_rgba(10,0,0,0.12)]"
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
        <div className="container-page hidden py-2 sm:block">
          <Breadcrumbs
            items={[
              { label: "Home", href: routeUrl("home") },
              { label: "Semua Model Produk" },
            ]}
          />
        </div>
      </section>

      <section className="border-b border-[#dee3e0] bg-white">
        <div className="container-page">
          <div className="flex items-center gap-2 pt-3 sm:pt-5">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
              aria-label="Kembali"
            >
              <Icon name="arrow-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="text-base font-bold tracking-tight text-[#333333]">Semua Model Produk</h1>
            <Link
              href={routeUrl("catalog.all")}
              className="-mr-2 ml-auto flex size-11 shrink-0 items-center justify-center rounded-md transition hover:bg-muted/50 sm:-mr-1"
              aria-label="Cari produk"
            >
              <Icon name="search" className="size-5" aria-hidden="true" />
            </Link>
          </div>

          <div className="flex items-center justify-between gap-4 pb-3 pt-1 sm:pb-4">
            <p className="text-xs text-[#666666] sm:text-sm">
              {formatNumber(totalCount)} model produk ditemukan
            </p>
            <SortMenu value={sort} onChange={selectSort} />
          </div>
        </div>
      </section>

      <section className="container-page py-5 md:py-8">
        {models.length ? (
          <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:gap-6 xl:grid-cols-4">
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
