import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { ModelProdukListingSidebar } from "@/components/public/catalog-listing-sidebar"
import { ModelCard } from "@/components/public/model-card"
import { FilterSheetContent } from "@/components/public/filter-sidebar"
import { ShowcaseCardGrid } from "@/components/public/product-card-grid"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Sheet, SheetTrigger } from "@/components/ui/sheet"
import PublicLayout from "@/layouts/public-layout"
import { formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { ModelCardData, SelectOption } from "@/types"

interface ModelProdukProps {
  models: ModelCardData[]
  filterDesigns: SelectOption[]
  activeDesign?: string | null
}

export default function ModelProduk({
  models = [],
  filterDesigns = [],
  activeDesign = null,
}: ModelProdukProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false)
  const [design, setDesign] = React.useState<string | null>(activeDesign ?? null)

  React.useEffect(() => {
    setDesign(activeDesign ?? null)
  }, [activeDesign])

  function selectDesign(value: string | null) {
    setDesign(value)
    setMobileFiltersOpen(false)
    router.get(
      routeUrl("catalog.index"),
      value ? { design: value } : {},
      { preserveState: true, preserveScroll: true, replace: true },
    )
  }

  function clearDesign() {
    selectDesign(null)
  }

  const hasActiveFilter = Boolean(design)

  return (
    <PublicLayout>
      <Head title="Semua Model Produk">
        <meta
          name="description"
          content="Bandingkan model jendela, pintu, dan boven aluminium berdasarkan jenis bukaan dan desain."
        />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page py-8 lg:py-10">
          <Breadcrumbs
            items={[
              { label: "Home", href: routeUrl("home") },
              { label: "Semua Model Produk" },
            ]}
          />

          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Semua Model Produk</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatNumber(models.length)} model ditemukan
              </p>
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="secondary" className="min-h-11 px-4">
                    <Icon name="sliders" className="h-4 w-4" aria-hidden="true" />
                    Filter
                    {hasActiveFilter ? (
                      <span className="flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        1
                      </span>
                    ) : null}
                  </Button>
                </SheetTrigger>
                <FilterSheetContent
                  title="Filter Model"
                  description="Saring model berdasarkan desain atau pilih kategori produk."
                >
                  <ModelProdukListingSidebar
                    filterDesigns={filterDesigns}
                    activeDesign={design}
                    onSelectDesign={selectDesign}
                    onClearDesign={clearDesign}
                  />
                </FilterSheetContent>
              </Sheet>
              {hasActiveFilter ? (
                <button
                  type="button"
                  onClick={clearDesign}
                  className="min-h-11 px-2 text-xs font-semibold text-primary"
                >
                  Hapus filter
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-8 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-10">
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <ModelProdukListingSidebar
                filterDesigns={filterDesigns}
                activeDesign={design}
                onSelectDesign={selectDesign}
                onClearDesign={clearDesign}
              />
            </div>
          </aside>

          <div>
            {models.length ? (
              <ShowcaseCardGrid>
                {models.map((model) => (
                  <ModelCard key={`${model.category}-${model.model}`} model={model} />
                ))}
              </ShowcaseCardGrid>
            ) : (
              <EmptyState
                icon="funnel"
                title="Belum ada model yang cocok"
                description={
                  design
                    ? "Desain ini belum tersedia pada model aktif. Hapus filter untuk melihat pilihan lain."
                    : "Model produk belum tersedia pada katalog aktif."
                }
                action={
                  design ? (
                    <Button onClick={clearDesign}>Hapus filter</Button>
                  ) : (
                    <Button asChild>
                      <Link href={routeUrl("contact")}>Hubungi kami</Link>
                    </Button>
                  )
                }
              />
            )}
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
