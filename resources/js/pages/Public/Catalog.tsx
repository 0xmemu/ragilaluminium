import { Head, Link, router, usePage } from "@inertiajs/react"
import * as React from "react"

import {
  CatalogProductListingSidebar,
  type CatalogListingFilters,
} from "@/components/public/catalog-listing-sidebar"
import {
  CatalogNav,
  type CatalogNavFilters,
} from "@/components/public/catalog-nav"
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
import PublicLayout from "@/layouts/public-layout"
import { formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
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
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
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
  const useModelToggles = isPromo

  const [loading, setLoading] = React.useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false)
  const [filters, setFilters] = React.useState<FilterState>({
    model: activeModel ?? "",
    design: activeDesign ?? "",
    priceMin: priceMin?.toString() ?? "",
    priceMax: priceMax?.toString() ?? "",
    sort: resolvedSort,
  })
  React.useEffect(() => {
    // Server-side Inertia navigation is the source of truth for filter state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const merged = { ...filters, ...next }
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
    const merged = { ...filters, ...next }

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
    visit(filters)
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

  const filterSheetContent = (
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
  )

  const filterToolbar = (
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
  )

  const catalogNav = (
    <CatalogNav
      category={category}
      categoryName={categoryName}
      total={pagination?.total ?? products.length}
      searchQuery={searchQuery}
      filterModels={filterModels}
      filterDesigns={filterDesigns}
      filters={{ model: filters.model, design: filters.design, sort: filters.sort || "popular" }}
      activeModel={activeModel}
      activeDesign={activeDesign}
      activeFilterCount={activeFilterCount}
      onVisit={(next: Partial<CatalogNavFilters>) => visit(next)}
      sheetOpen={mobileFiltersOpen}
      onSheetOpenChange={setMobileFiltersOpen}
      filterSheet={filterSheetContent}
    />
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
      <div className="grid min-w-0 gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-10">
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

      {!isFlash && flashSaleSpotlight.length > 0 ? (
        <PromoFlashSaleSection products={flashSaleSpotlight} period={period} />
      ) : null}

      {isFlash ? (
        <FlashSaleHero period={period} />
      ) : isPromo ? (
        <section className="border-b border-border bg-surface">
          <div className="container-page hidden py-4 sm:block">
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
          </div>

          <div className="container-page pb-4 pt-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
                aria-label="Kembali"
              >
                <Icon name="caret-left" className="size-5" aria-hidden="true" />
              </button>
              <h1 className="flex items-baseline gap-2 text-lg font-bold leading-snug tracking-tight text-foreground">
              {categoryName}
              <span className="font-normal text-muted-foreground">|</span>
              <span className="text-sm font-normal text-muted-foreground">
                {formatNumber(pagination?.total ?? products.length)} produk ditemukan
                {searchQuery ? ` untuk “${searchQuery}”` : ""}
              </span>
            </h1>
            </div>
          </div>
        </section>
      ) : (
        catalogNav
      )}

      {isPromo ? (
        <div className="container-page flex justify-end py-3">
          {filterToolbar}
        </div>
      ) : null}

      {isFlash ? <FlashSaleListingShell>{listingBody}</FlashSaleListingShell> : listingBody}

      {!isFlash && !isPromo && activeSort !== "popular" ? (
        <PalingBanyakDipesanSection products={popularProducts} />
      ) : null}
    </PublicLayout>
  )
}
