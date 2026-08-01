import { Head, Link, router, usePage } from "@inertiajs/react"
import * as React from "react"

import {
  CatalogProductListingSidebar,
  type CatalogListingFilters,
} from "@/components/public/catalog-listing-sidebar"
import {
  FlashSaleHero,
  FlashSaleListingShell,
  FlashSaleListingToolbar,
  FlashModelToggles,
  PromoFlashSaleSection,
} from "@/components/public/flash-sale-stage"
import { PalingBanyakDipesanSection } from "@/components/public/paling-banyak-dipesan-section"
import { ProductCard } from "@/components/public/product-card"
import { ProductCardGrid } from "@/components/public/product-card-grid"
import {
  CATALOG_SORT_OPTIONS,
  FilterBerdasarkanControl,
} from "@/components/public/filter-berdasarkan-control"
import { FilterSheetContent } from "@/components/public/filter-sidebar"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Pagination } from "@/components/ui/pagination"
import { ProductGridSkeleton } from "@/components/ui/skeleton"
import { Sheet, SheetTrigger } from "@/components/ui/sheet"
import PublicLayout from "@/layouts/public-layout"
import { formatNumber } from "@/lib/format"
import { routeUrl, withQuery } from "@/lib/routes"
import type {
  FlashSalePeriod,
  Pagination as PaginationData,
  ProductCardData,
  SelectOption,
  SharedPageProps,
} from "@/types"

type ListingMode = "catalog" | "promo" | "flash"

interface CatalogProps {
  category: string
  categoryName: string
  listingMode?: ListingMode
  isAllProductsListing?: boolean
  products: ProductCardData[]
  popularProducts?: ProductCardData[]
  youMightLike?: ProductCardData[]
  flashSaleSpotlight?: ProductCardData[]
  flashSalePeriod?: FlashSalePeriod | null
  pagination: PaginationData
  filterModels: SelectOption[]
  filterDesigns: SelectOption[]
  activeModel?: string | null
  activeDesign?: string | null
  activeSort?: string | null
  searchQuery?: string
  priceMin?: number | null
  priceMax?: number | null
  basePath: string
  canonicalUrl: string
  robotsDirective: string
}

interface FilterState extends CatalogListingFilters {
  sort: string
}

function FilterSheetFooter({
  onReset,
  onApply,
}: {
  onReset: () => void
  onApply: () => void
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
      <Button variant="secondary" className="min-h-12" onClick={onReset}>
        Reset
      </Button>
      <Button className="min-h-12 font-bold" onClick={onApply}>
        Terapkan filter
      </Button>
    </div>
  )
}

function resolveSortValue(sort: string | null | undefined): string {
  return sort && sort !== "" ? sort : "popular"
}

export default function Catalog({
  category,
  categoryName,
  listingMode = "catalog",
  isAllProductsListing = false,
  products = [],
  popularProducts = [],
  youMightLike = [],
  flashSaleSpotlight = [],
  flashSalePeriod = null,
  pagination,
  filterModels = [],
  filterDesigns = [],
  activeModel = null,
  activeDesign = null,
  activeSort = null,
  searchQuery = "",
  priceMin = null,
  priceMax = null,
  basePath,
  canonicalUrl,
  robotsDirective,
}: CatalogProps) {
  const sharedPeriod = usePage<SharedPageProps>().props.flashSalePeriod
  const period = flashSalePeriod ?? sharedPeriod ?? null
  const isFlash = listingMode === "flash" || basePath === "/flash-sale"
  const isPromo = listingMode === "promo" || basePath === "/promo"
  const listingAllProducts = isAllProductsListing || category === "ALL" || basePath === "/products"
  const resolvedSort = resolveSortValue(activeSort)
  const flashLive = period?.live === true
  const useModelToggles = isFlash || isPromo

  const [loading, setLoading] = React.useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false)
  const [filters, setFilters] = React.useState<FilterState>({
    model: activeModel ?? "",
    design: activeDesign ?? "",
    priceMin: priceMin?.toString() ?? "",
    priceMax: priceMax?.toString() ?? "",
    sort: resolvedSort,
  })
  const filtersRef = React.useRef(filters)
  filtersRef.current = filters

  React.useEffect(() => {
    setFilters({
      model: activeModel ?? "",
      design: activeDesign ?? "",
      priceMin: priceMin?.toString() ?? "",
      priceMax: priceMax?.toString() ?? "",
      sort: resolveSortValue(activeSort),
    })
  }, [activeModel, activeDesign, priceMin, priceMax, activeSort])

  function visit(
    next: Partial<FilterState> = {},
    options?: { clearSearch?: boolean; q?: string | null },
  ) {
    const merged = { ...filtersRef.current, ...next }
    const sort = resolveSortValue(merged.sort)
    const nextQuery =
      options?.clearSearch
        ? undefined
        : options && "q" in options
          ? options.q?.trim() || undefined
          : searchQuery || undefined

    setFilters(merged)
    setLoading(true)
    router.get(
      basePath,
      {
        q: nextQuery,
        model: merged.model || undefined,
        design: merged.design || undefined,
        price_min: merged.priceMin || undefined,
        price_max: merged.priceMax || undefined,
        // Populer adalah urutan kanonis/default; query hanya diperlukan untuk pilihan lain.
        sort: sort === "popular" ? undefined : sort,
      },
      {
        preserveScroll: true,
        preserveState: false,
        replace: true,
        onFinish: () => setLoading(false),
      },
    )
  }

  function reset() {
    const pageSort = "popular"
    const empty = {
      model: "",
      design: "",
      priceMin: "",
      priceMax: "",
      sort: pageSort,
    }
    setMobileFiltersOpen(false)
    visit(empty)
  }

  function handleLiveSidebarChange(next: Partial<CatalogListingFilters>) {
    const merged = { ...filtersRef.current, ...next }

    const touchesPrice = "priceMin" in next || "priceMax" in next
    const clearingPrice = touchesPrice && !merged.priceMin && !merged.priceMax
    const editingPrice = touchesPrice && !clearingPrice

    setFilters(merged)

    if (editingPrice) {
      return
    }

    visit(merged)
  }

  function applyLivePrice() {
    visit(filtersRef.current)
  }

  const activeFilterCount = [activeModel, activeDesign, priceMin, priceMax, searchQuery]
    .filter((value) => value !== null && value !== "")
    .length

  const sidebarProps = {
    filterModels,
    filterDesigns,
    filters,
    // Optimistic UI: bind radios to local filter state so clicks don't snap back
    // while waiting for Inertia. useEffect syncs from server props after visit.
    activeModel: filters.model || null,
    activeDesign: filters.design || null,
    priceMin: filters.priceMin ? Number(filters.priceMin) : null,
    priceMax: filters.priceMax ? Number(filters.priceMax) : null,
    currentHref: listingAllProducts
      ? routeUrl("catalog.all")
      : basePath,
    consultationSource: "catalog",
    onClearAll: reset,
  }

  const filterToolbar = isPromo ? (
    <div className="flex items-end gap-2">
      <FilterBerdasarkanControl
        id="promo-sort"
        variant="plain"
        value={filters.sort || "popular"}
        options={CATALOG_SORT_OPTIONS}
        onChange={(sort) => visit({ sort, design: "", priceMin: "", priceMax: "" })}
        ariaLabel="Urutkan produk promo"
      />
    </div>
  ) : isFlash ? null : (
    <div className="flex items-end gap-2">
      <FilterBerdasarkanControl
        id="catalog-sort"
        variant="plain"
        value={filters.sort || "popular"}
        options={CATALOG_SORT_OPTIONS}
        onChange={(sort) => visit({ sort })}
        ariaLabel="Urutkan produk"
      />
      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 px-0.5 text-xs font-semibold text-foreground sm:text-sm transition hover:text-primary lg:hidden"
          >
            <Icon name="sliders" className="h-3.5 w-3.5" aria-hidden="true" />
            Filter
            {activeFilterCount > 0 ? (
              <span className="tabular-nums flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </SheetTrigger>
        <FilterSheetContent
          title="Filter"
          description="Pilih produk yang paling sesuai kebutuhan rumah Anda."
          footer={
            <FilterSheetFooter
              onReset={reset}
              onApply={() => {
                setMobileFiltersOpen(false)
                visit()
              }}
            />
          }
        >
          <CatalogProductListingSidebar
            {...sidebarProps}
            variant="draft"
            fieldSuffix="sheet"
            onFiltersChange={(next) =>
              setFilters((current) => ({ ...current, ...next }))
            }
          />
        </FilterSheetContent>
      </Sheet>
      {activeFilterCount > 0 ? (
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-8 items-center px-0.5 text-xs font-semibold text-primary lg:hidden"
        >
          Hapus
        </button>
      ) : null}
    </div>
  )

  const showYouMightLike = Boolean(searchQuery?.trim()) && youMightLike.length > 0

  const productGallery = (
    <div aria-busy={loading}>
      <div className="sr-only" role="status" aria-live="polite">
        {loading ? "Memuat produk" : "Daftar produk selesai dimuat"}
      </div>
      {loading ? (
        <ProductGridSkeleton />
      ) : showYouMightLike || products.length ? (
        <>
          {showYouMightLike ? (
            <section className="mb-8" aria-labelledby="you-might-like-heading">
              <div className="mb-4">
                <h2
                  id="you-might-like-heading"
                  className="text-lg font-bold tracking-tight text-foreground sm:text-xl"
                >
                  Anda mungkin suka
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Flash Sale terkait pencarian atau model yang sama.
                </p>
              </div>
              <ProductCardGrid>
                {youMightLike.map((product, index) => (
                  <ProductCard
                    key={`like-${product.id}`}
                    product={product}
                    priority={index < 4}
                    emphasis="flash"
                  />
                ))}
              </ProductCardGrid>
            </section>
          ) : null}

          {products.length ? (
            <>
              {showYouMightLike ? (
                <h2 className="mb-4 text-base font-bold tracking-tight text-foreground sm:text-lg">
                  Hasil pencarian
                </h2>
              ) : null}
              <ProductCardGrid>
                {products.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    priority={!showYouMightLike && index < 4}
                    emphasis={isFlash ? "flash" : "default"}
                  />
                ))}
              </ProductCardGrid>
              <Pagination pagination={pagination} />
            </>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="funnel"
          title={
            isFlash && !flashLive
              ? period?.status === "scheduled"
                ? "Flash Sale belum dimulai"
                : period?.status === "ended"
                  ? "Flash Sale sudah berakhir"
                  : "Flash Sale sedang disiapkan"
              : isFlash
                ? "Belum ada produk Flash Sale"
                : isPromo
                  ? "Belum ada produk promo"
                  : searchQuery
                    ? `Tidak ada hasil untuk “${searchQuery}”`
                    : "Belum ada produk yang cocok"
          }
          description={
            isFlash && !flashLive
              ? period?.status === "scheduled"
                ? `Periode dimulai ${period.starts_at_label ?? "segera"}. Produk akan tampil otomatis saat waktu mulai.`
                : period?.status === "ended"
                  ? `Periode berakhir ${period.ends_at_label ?? "sudah lewat"}. Pantau menu Flash Sale untuk periode berikutnya.`
                  : "Flash Sale sedang disiapkan. Pantau pengumuman kami atau lihat promo yang sedang berjalan."
              : useModelToggles && activeModel
                ? `Belum ada produk ${isFlash ? "Flash Sale" : "promo"} untuk model ini. Coba model lain atau pilih Semua.`
                : isFlash
                  ? "Flash Sale sedang disiapkan. Produk akan tampil di sini saat periode berlangsung."
                  : isPromo
                    ? "Produk promo akan muncul di sini ketika ada penawaran aktif."
                    : searchQuery
                      ? `Tidak ada hasil untuk “${searchQuery}”. Coba kata lain atau lihat semua model.`
                      : "Hapus sebagian filter atau coba kata pencarian lain untuk melihat pilihan yang tersedia."
          }
          action={
            isFlash && !flashLive ? (
              <Button asChild>
                <Link href={routeUrl("catalog.promo")}>Lihat promo</Link>
              </Button>
            ) : (
              <Button
                onClick={() =>
                  useModelToggles
                    ? visit({ model: "", design: "", priceMin: "", priceMax: "" })
                    : searchQuery
                      ? visit({}, { clearSearch: true })
                      : reset()
                }
              >
                {searchQuery
                  ? "Lihat semua model"
                  : useModelToggles && activeModel
                    ? "Lihat semua model"
                    : "Hapus semua filter"}
              </Button>
            )
          }
        />
      )}
    </div>
  )

  const listingBody = useModelToggles ? (
    <section className="container-page py-4 lg:py-5">
      {isFlash ? (
        <FlashSaleListingToolbar
          sort={filters.sort || "popular"}
          priceMin={filters.priceMin}
          priceMax={filters.priceMax}
          searchQuery={searchQuery}
          onSortChange={(sort) => visit({ sort })}
          onPriceApply={({ priceMin: nextMin, priceMax: nextMax }) =>
            visit({ priceMin: nextMin, priceMax: nextMax })
          }
          onSearch={(q) => visit({}, { q })}
        />
      ) : isPromo ? (
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <FlashModelToggles
            models={filterModels}
            activeModel={activeModel}
            ariaLabel="Pilih model promo"
            onSelect={(model) =>
              visit({
                model,
                design: "",
                priceMin: "",
                priceMax: "",
              })
            }
          />
        </div>
      ) : null}
      {productGallery}
    </section>
  ) : (
    <section className="container-page py-4 lg:py-5">
      <div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <CatalogProductListingSidebar
              {...sidebarProps}
              variant="live"
              onFiltersChange={handleLiveSidebarChange}
              onApplyPrice={applyLivePrice}
            />
          </div>
        </aside>
        {productGallery}
      </div>
    </section>
  )

  return (
    <PublicLayout>
      <Head title={categoryName}>
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content={robotsDirective} />
        <meta
          name="description"
          content={
            isFlash
              ? "Flash Sale Ragil Aluminium. Harga spesial untuk produk yang ditandai Flash Sale."
              : isPromo
                ? "Promo Ragil Aluminium. Produk dengan diskon dan harga spesial."
                : listingAllProducts
                  ? "Jelajahi jendela, pintu, dan bouven aluminium Ragil Aluminium untuk rumah Anda."
                  : `Pilihan ${categoryName.toLowerCase()} aluminium Ragil Aluminium, siap custom ukuran.`
          }
        />
      </Head>

      {isFlash ? (
        <FlashSaleHero period={period} />
      ) : (
        <section className="border-b border-border bg-surface">
          <div className="container-page py-4 lg:py-5">
            <Breadcrumbs
              items={[
                { label: "Home", href: routeUrl("home") },
                ...(listingAllProducts
                  ? [{ label: categoryName }]
                  : [
                      { label: "Semua Model Produk", href: routeUrl("catalog.index") },
                      { label: categoryName },
                    ]),
              ]}
            />

            <div className="mt-5">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {categoryName}
              </h1>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="min-w-0 text-sm leading-8 text-muted-foreground">
                  {formatNumber(pagination?.total ?? products.length)} produk ditemukan
                  {searchQuery ? ` untuk “${searchQuery}”` : ""}.
                </p>
                {filterToolbar ? (
                  <div className="flex shrink-0 items-end justify-end">{filterToolbar}</div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      )}

      {isPromo ? (
        <PromoFlashSaleSection products={flashSaleSpotlight} period={period} />
      ) : null}

      {isFlash ? <FlashSaleListingShell>{listingBody}</FlashSaleListingShell> : listingBody}

      {listingAllProducts && !isFlash && !isPromo ? (
        <PalingBanyakDipesanSection products={popularProducts} />
      ) : null}
    </PublicLayout>
  )
}
