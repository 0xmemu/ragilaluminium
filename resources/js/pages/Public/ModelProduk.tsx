import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { ModelProdukListingSidebar } from "@/components/public/catalog-listing-sidebar"
import { FilterBerdasarkanControl } from "@/components/public/filter-berdasarkan-control"
import { Icon } from "@/components/shared/icon"
import { ModelCard } from "@/components/public/model-card"
import { ShowcaseCardGrid } from "@/components/public/product-card-grid"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { useSwipeClickSuppression } from "@/hooks/use-swipe-click-suppression"
import PublicLayout from "@/layouts/public-layout"
import { formatNumber } from "@/lib/format"
import { routeUrl, withQuery } from "@/lib/routes"
import type { ModelCardData, SelectOption } from "@/types"

interface ModelProdukProps {
  models: ModelCardData[]
  filterDesigns: SelectOption[]
  filterModels?: SelectOption[]
  activeDesign?: string | null
  activeCategory?: string | null
}

const CATEGORY_TABS = [
  { code: "", label: "Semua", slug: undefined },
  { code: "WINDOW", label: "Jendela", slug: "windows" },
  { code: "DOOR", label: "Pintu", slug: "doors" },
  { code: "BOUVEN", label: "Boven", slug: "bouven" },
] as const

export default function ModelProduk({
  models = [],
  filterDesigns = [],
  filterModels = [],
  activeDesign = null,
  activeCategory = null,
}: ModelProdukProps) {
  const navRef = React.useRef<HTMLElement>(null)
  useSwipeClickSuppression(navRef)

  const [design, setDesign] = React.useState<string | null>(activeDesign ?? null)

  React.useEffect(() => {
    // Inertia navigation can replace the active filter while this page instance remains mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  function navigate(value: string | null) {
    router.get(
      routeUrl("catalog.index"),
      value
        ? { category: activeCategory ?? undefined, design: value }
        : activeCategory
          ? { category: activeCategory }
          : {},
      { preserveState: true, preserveScroll: true, replace: true },
    )
  }

  const designOptions = React.useMemo(
    () => [
      { value: "", label: "Semua Desain" },
      ...filterDesigns.map((item) => ({ value: item.value, label: item.label })),
    ],
    [filterDesigns],
  )

  // Tab model untuk kategori aktif — pola "Boven Swing", "Jendela Sliding", dst.
  // Mengarah ke listing produk model terkait (filter query), bukan pindah halaman detail.
  const activeCategoryTab = CATEGORY_TABS.find((tab) => tab.code === activeCategory)
  const modelTabs = React.useMemo(() => {
    if (!activeCategory || !filterModels.length) return []
    return filterModels.map((model) => ({
      value: model.value,
      label: `${activeCategoryTab?.label ?? ""} ${model.label}`.trim(),
      href: withQuery(
        routeUrl("catalog.category", {
          category: activeCategoryTab?.slug,
        }),
        { model: model.value },
      ),
    }))
  }, [activeCategory, filterModels, activeCategoryTab])

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

        <div className="container-page">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
              aria-label="Kembali"
            >
              <Icon name="arrow-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="flex items-baseline gap-2 text-base font-bold tracking-tight text-foreground">
            Semua Model Produk
            <span className="font-normal text-muted-foreground">|</span>
            <span className="text-sm font-normal text-muted-foreground">
              {formatNumber(models.length)} model ditemukan
            </span>
          </h1>
          </div>
        </div>
      </section>

      {/* Navigasi kategori + model — frame grey (mati) / hitam (dipilih) */}
      <nav ref={navRef} aria-label="Kategori model produk" className="scrollbar-x flex gap-2 overflow-x-auto border-b border-border bg-surface px-5 py-3 md:px-8 lg:px-12">
        {CATEGORY_TABS.map((tab) => {
          const active = (tab.code || null) === (activeCategory || null)
          return (
            <Link
              key={tab.code || "all"}
              href={routeUrl("catalog.index", {
                category: tab.code || undefined,
                design: design || undefined,
              })}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg border border-foreground bg-foreground px-3.5 text-[13px] font-semibold text-background shadow-sm"
                  : "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg border border-border bg-surface px-3.5 text-[13px] font-semibold text-foreground transition hover:border-foreground/50"
              }
            >
              {tab.label}
            </Link>
          )
        })}

        {modelTabs.map((model) => (
          <Link
            key={model.value}
            href={model.href}
            className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg border border-border bg-surface px-3.5 text-[13px] font-medium text-muted-foreground transition hover:border-foreground/50 hover:text-foreground"
          >
            {model.label}
          </Link>
        ))}
      </nav>

      <div className="container-page flex justify-end py-3 lg:hidden">
        <FilterBerdasarkanControl
          id="model-produk-design"
          variant="plain"
          value={design ?? ""}
          options={designOptions}
          onChange={(value) => navigate(value || null)}
          ariaLabel="Filter desain model"
          menuLabel="Desain"
        />
      </div>

      <section className="container-page !px-5 md:!px-8 lg:!px-12">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-10">
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <ModelProdukListingSidebar
                filterDesigns={filterDesigns}
                activeDesign={design}
                onSelectDesign={navigate}
                onClearDesign={() => navigate(null)}
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
