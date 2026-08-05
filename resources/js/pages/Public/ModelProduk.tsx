import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { ModelProdukListingSidebar } from "@/components/public/catalog-listing-sidebar"
import { FilterBerdasarkanControl } from "@/components/public/filter-berdasarkan-control"
import { Icon } from "@/components/shared/icon"
import { ModelCard } from "@/components/public/model-card"
import { PalingBanyakDipesanSection } from "@/components/public/paling-banyak-dipesan-section"
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
        <div className="container-page hidden py-4 sm:block">
          <Breadcrumbs
            items={[
              { label: "Home", href: routeUrl("home") },
              { label: "Semua Model Produk" },
            ]}
          />
        </div>

        <div className="container-page pb-4 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="flex shrink-0 items-center justify-center sm:hidden"
              aria-label="Kembali"
            >
              <Icon name="caret-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="flex items-baseline gap-2 text-lg font-bold leading-snug tracking-tight text-foreground">
            Semua Model Produk
            <span className="font-normal text-muted-foreground">|</span>
            <span className="text-sm font-normal text-muted-foreground">
              {formatNumber(models.length)} model ditemukan
            </span>
          </h1>
          </div>
        </div>
      </section>

      <div className="container-page flex justify-end py-3 lg:hidden">
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

      <section className="container-page py-4 lg:py-5">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-10">
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
