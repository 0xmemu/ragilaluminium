import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { ModelProdukListingSidebar } from "@/components/public/catalog-listing-sidebar"
import { FilterBerdasarkanControl } from "@/components/public/filter-berdasarkan-control"
import { ModelCard } from "@/components/public/model-card"
import { PalingBanyakDipesanSection } from "@/components/public/paling-banyak-dipesan-section"
import { SearchDialog } from "@/components/public/search-dialog"
import { ShowcaseCardGrid } from "@/components/public/product-card-grid"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import PublicLayout from "@/layouts/public-layout"
import { formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { ModelCardData, ProductCardData, SelectOption } from "@/types"

interface ModelProdukProps {
  models: ModelCardData[]
  popularProducts?: ProductCardData[]
  filterDesigns: SelectOption[]
  activeDesign?: string | null
}

export default function ModelProduk({
  models = [],
  popularProducts = [],
  filterDesigns = [],
  activeDesign = null,
}: ModelProdukProps) {
  const [design, setDesign] = React.useState<string | null>(activeDesign ?? null)

  React.useEffect(() => {
    setDesign(activeDesign ?? null)
  }, [activeDesign])

  function selectDesign(value: string | null) {
    setDesign(value)
    router.get(
      routeUrl("catalog.index"),
      value ? { design: value } : {},
      { preserveState: true, preserveScroll: true, replace: true },
    )
  }

  function clearDesign() {
    selectDesign(null)
  }

  const designOptions = React.useMemo(
    () => [
      { value: "", label: "Semua Desain" },
      ...filterDesigns.map((item) => ({ value: item.value, label: item.label })),
    ],
    [filterDesigns],
  )

  return (
    <PublicLayout>
      <Head title="Semua Model Produk">
        <meta
          name="description"
          content="Bandingkan model jendela, pintu, dan boven aluminium berdasarkan jenis bukaan dan desain."
        />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page py-4 lg:py-5">
          <Breadcrumbs
            items={[
              { label: "Home", href: routeUrl("home") },
              { label: "Semua Model Produk" },
            ]}
          />

          <div className="mt-5">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Semua Model Produk</h1>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="min-w-0 text-sm leading-8 text-muted-foreground">
                {formatNumber(models.length)} model ditemukan
              </p>

              <div className="flex shrink-0 items-end gap-2">
                <SearchDialog
                  triggerClassName="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:w-10"
                />
                <div className="lg:hidden">
                  <FilterBerdasarkanControl
                    id="model-produk-design"
                    variant="plain"
                    value={design ?? ""}
                    options={designOptions}
                    onChange={(value) => selectDesign(value || null)}
                    ariaLabel="Filter desain model"
                    menuLabel="Desain"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-4 lg:py-5">
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

      <PalingBanyakDipesanSection products={popularProducts} />
    </PublicLayout>
  )
}
