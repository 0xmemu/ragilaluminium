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

import { PalingBanyakDipesanSection } from "@/components/public/home-sections"
import { ProductCard } from "@/components/public/product-card"
import { ProductCardGrid } from "@/components/public/product-card-grid"
import { FlashSaleCarouselSection } from "@/components/public/flash-sale-carousel-section"
import { FlashSaleCountdown, FlashSaleLabel } from "@/components/public/flash-sale-stage"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Pagination } from "@/components/ui/pagination"
import { ProductListingFrame } from "@/components/public/product-listing-frame"
import PublicLayout from "@/layouts/public-layout"
import { catalogPageSizeParam, clampCatalogPage, resolveCatalogPageSize, type CatalogPageSizes } from "@/lib/catalog-page-size"
import { useCatalogViewportWidth } from "@/hooks/use-catalog-viewport-width"
import { resolveCtaActions } from "@/lib/cta-actions"
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
  categoryLinks?: Array<{ slug: string; code: string; label: string }>
  listingMode?: ListingMode
  isAllProductsListing?: boolean
  products: ProductCardData[]
  popularProducts?: ProductCardData[]
  flashSaleSpotlight?: ProductCardData[]
  youMightLike?: ProductCardData[]
  flashSalePeriod?: FlashSalePeriod | null
  pagination: PaginationData
  /** Ukuran halaman resmi dari server (desktop & mobile). */
  catalogPageSize?: CatalogPageSizes
  filterModels: SelectOption[]
  filterDesigns: SelectOption[]
  activeModel?: string | null
  activeDesign?: string | null
  activeSort?: string | null
  searchQuery?: string
  priceMin?: number | null
  priceMax?: number | null
  searchFallback?: {
    nearby_sizes: ProductCardData[]
    related_models: Array<{ label: string; href: string }>
  } | null
  basePath: string
  canonicalUrl: string
  robotsDirective: string
}

interface FilterState extends CatalogListingFilters {
  sort: string
}

function SearchFallbackEmpty({
  query,
  nearbySizes,
  relatedModels,
}: {
  query: string
  nearbySizes: ProductCardData[]
  relatedModels: Array<{ label: string; href: string }>
}) {
  const { consultationWhatsApp, ctaSettings } = usePage<SharedPageProps>().props
  // Teks & tombol diatur admin lewat CTA Storefront, blok
  // "Katalog: saat pencarian kosong". Judul pertama tetap memuat kata kunci
  // pencarian, jadi hanya keterangan & tombolnya yang dapat diubah.
  const configured = ctaSettings?.pages?.["catalog-empty"]
  const whatsappUrl = consultationWhatsApp?.directUrl ?? routeUrl("contact")
  const configuredActions = resolveCtaActions(configured?.actions, whatsappUrl)

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border bg-surface p-5">
        <p className="text-sm font-bold text-foreground">Tidak ada hasil untuk “{query}”</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {configured?.heading ||
            "Tidak menemukan ukuran yang sesuai? Tim kami siap membantu memastikan produk pas dengan kebutuhan Anda."}
        </p>
        {configuredActions.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {configuredActions.map((action) => (
              <Button
                key={action.label}
                asChild
                variant={action.variant === "secondary" ? "secondary" : undefined}
              >
                <a href={action.href} {...(action.external ? { target: "_blank", rel: "noreferrer" } : {})}>
                  {action.whatsappIcon ? (
                    <Icon name="whatsapp" className="size-4" aria-hidden="true" />
                  ) : null}
                  {action.label}
                </a>
              </Button>
            ))}
          </div>
        ) : nearbySizes.length === 0 && relatedModels.length === 0 ? (
          <Button asChild variant="secondary" className="mt-3">
            <Link href={routeUrl("catalog.all")}>Lihat semua model</Link>
          </Button>
        ) : null}
      </div>

      {nearbySizes.length ? (
        <section aria-labelledby="nearby-size-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 id="nearby-size-heading" className="text-base font-bold text-foreground">
              Ukuran terdekat yang tersedia
            </h2>
          </div>
          <ProductCardGrid>
            {nearbySizes.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 4} titleStyle="model" />
            ))}
          </ProductCardGrid>
        </section>
      ) : null}

      {relatedModels.length ? (
        <section aria-labelledby="related-model-heading">
          <h2 id="related-model-heading" className="text-base font-bold text-foreground">
            Kategori terkait
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {relatedModels.map((model) => (
              <Link
                key={`${model.label}-${model.href}`}
                href={model.href}
                className="inline-flex min-h-10 items-center rounded-full border border-border bg-surface px-4 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
              >
                {model.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}


function resolveSortValue(sort: string | null | undefined): string {
  return sort && sort !== "" ? sort : "popular"
}

export default function Catalog({
  category,
  categoryName,
  categoryLinks = [],
  listingMode = "catalog",
  isAllProductsListing = false,
  products = [],
  popularProducts = [],
  flashSaleSpotlight = [],
  youMightLike = [],
  flashSalePeriod = null,
  pagination,
  catalogPageSize = { desktop: 15, mobile: 16 },
  filterModels = [],
  filterDesigns = [],
  activeModel = null,
  activeDesign = null,
  activeSort = null,
  searchQuery = "",
  priceMin = null,
  priceMax = null,
  searchFallback = null,
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
  const fromTopSold = React.useMemo(() => {
    if (typeof window === "undefined") return false
    return new URLSearchParams(window.location.search).get("from") === "paling-banyak-dipesan"
  }, [])
  const flashCarouselProducts = React.useMemo(() => flashSaleSpotlight, [flashSaleSpotlight])

  // Jumlah kartu per halaman dihitung server, jadi server tidak tahu lebar
  // layar. Di bawah breakpoint sm grid hanya 2 kolom dan 15 kartu menyisakan
  // satu kartu menggantung di baris terakhir, jadi klien meminta 16 kartu lewat
  // parameter per_page. Lebar 0 (belum terukur) = ukuran desktop, sama dengan
  // yang sudah dikirim server, sehingga render pertama tidak memicu muat ulang.
  const viewportWidth = useCatalogViewportWidth()
  const perPage = resolveCatalogPageSize(viewportWidth, catalogPageSize)
  const perPageParam = catalogPageSizeParam(perPage, catalogPageSize)
  const serverPerPage = pagination?.per_page ?? null

  // JARING PENGAMAN. Server sudah mengenali telepon dari User-Agent, jadi
  // pelanggan di HP menerima 16 kartu sejak render pertama. Efek ini menangani
  // sisa kasus yang tidak terlihat User-Agent: jendela desktop yang
  // dipersempit, dan HP yang diputar ke lanskap (grid jadi 3 kolom). Setelah
  // lebar terbaca, minta ulang SEKALI dengan ukuran yang benar. Efek ini
  // konvergen: respons berikutnya sudah membawa ukuran yang cocok.
  // Nomor halaman dijepit karena jumlah halaman ikut berubah bersama ukurannya.
  React.useEffect(() => {
    if (viewportWidth <= 0) return
    if (serverPerPage === null || serverPerPage === perPage) return

    const params = new URLSearchParams(window.location.search)
    if (perPageParam === undefined) {
      params.delete("per_page")
    } else {
      params.set("per_page", String(perPageParam))
    }

    const total = pagination?.total ?? 0
    const targetPage = clampCatalogPage(pagination?.current_page ?? 1, total, perPage)
    if (targetPage <= 1) {
      params.delete("page")
    } else {
      params.set("page", String(targetPage))
    }

    router.get(basePath, Object.fromEntries(params), {
      preserveScroll: true,
      preserveState: false,
      replace: true,
    })
  }, [viewportWidth, serverPerPage, perPage, perPageParam, basePath, pagination])

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
        // Penanda asal carousel ikut dipertahankan supaya urutan kurasi
        // "Paling Banyak Dipesan" tidak diam-diam balik ke skor penjualan
        // saat pembeli mengganti filter atau urutan.
        from: fromTopSold ? "paling-banyak-dipesan" : undefined,
        // Populer adalah urutan kanonis/default; query hanya diperlukan untuk pilihan lain.
        sort: sort === "popular" ? undefined : sort,
        flash: isFlash ? 1 : undefined,
        // Ukuran halaman yang pas untuk lebar layar sekarang. Filter dan
        // navigasi dibangun ulang dari sini supaya jumlah kartu tidak diam-diam
        // kembali ke default desktop saat filter diganti.
        per_page: perPageParam,
      },
      {
        preserveScroll: true,
        preserveState: false,
        replace: true,
        onFinish: () => setLoading(false),
      },
    )
  }

  function toggleFlash() {
    setLoading(true)
    // Halaman /flash-sale adalah halaman khusus (bukan listing berfilter), jadi
    // mematikan pill di sana harus kembali ke daftar produk biasa. Sebelumnya
    // navigasi memakai basePath apa adanya sehingga pill aktif tapi diklik tidak
    // melakukan apa pun (memuat ulang halaman yang sama).
    const targetPath = isFlash && basePath === "/flash-sale" ? "/products/all" : basePath
    const sort = resolveSortValue(filters.sort)
    router.get(
      targetPath,
      {
        // Filter lain dipertahankan seperti visit(): pill Flash adalah filter,
        // bukan tombol reset. Sebelumnya filter model/desain/harga/pencarian dan
        // penanda asal carousel ikut terbuang saat pill ini diklik.
        q: searchQuery || undefined,
        model: filters.model || undefined,
        design: filters.design || undefined,
        price_min: filters.priceMin || undefined,
        price_max: filters.priceMax || undefined,
        from: fromTopSold ? "paling-banyak-dipesan" : undefined,
        sort: sort === "popular" ? undefined : sort,
        flash: isFlash ? undefined : 1,
        per_page: perPageParam,
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
    onClearAll: reset,
    categoryLinks,
    activeCategory: category,
  }

    const filterSheetContent = (
    <>
      <CatalogProductListingSidebar
        {...sidebarProps}
        variant="draft"
        fieldSuffix="sheet"
        onApplyPrice={() => visit({ priceMin: filters.priceMin, priceMax: filters.priceMax })}
        onFiltersChange={(next) =>
          setFilters((current) => ({ ...current, ...next }))
        }
      />
    </>
  )

  

  const catalogNav = (
    <CatalogNav
      category={category}
      categoryName={categoryName}
      total={pagination?.total ?? products.length}
      searchQuery={searchQuery}
      filterModels={filterModels}
      filterDesigns={filterDesigns}
      categoryLinks={categoryLinks}
      filters={{ model: filters.model, design: filters.design, sort: filters.sort || "popular" }}
      activeModel={activeModel}
      activeDesign={activeDesign}
      activeFilterCount={activeFilterCount}
      onVisit={(next: Partial<CatalogNavFilters>) => visit(next)}
      onToggleFlash={() => toggleFlash()}
      sheetOpen={mobileFiltersOpen}
      onSheetOpenChange={setMobileFiltersOpen}
      filterSheet={filterSheetContent}
      basePath={basePath}
      isFlash={isFlash}
      priceMin={filters.priceMin}
      priceMax={filters.priceMax}
      onReset={reset}
      showHeader={false}
      breadcrumbItems={[
        { label: "Beranda", href: routeUrl("home") },
        ...(listingAllProducts
          ? [{ label: categoryName }]
          : [
              {label: "Model Produk", href: routeUrl("catalog.index")},
              { label: categoryName },
            ]),
      ]}
    />
  )

  const showYouMightLike = Boolean(searchQuery?.trim()) && youMightLike.length > 0

  const productGallery = (
    <div aria-busy={loading}>
      <div className="sr-only" role="status" aria-live="polite">
        {loading ? "Memuat produk" : "Daftar produk selesai dimuat"}
      </div>
      {showYouMightLike || products.length ? (
        <>
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
                    titleStyle="model"
                  />
                ))}
              </ProductCardGrid>

            </>
          ) : null}

          {showYouMightLike ? (
            <section className="mb-8 mt-10" aria-labelledby="you-might-like-heading">
              <div className="mb-4">
                <h2
                  id="you-might-like-heading"
                  className="text-lg font-bold tracking-tight text-foreground"
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
                    titleStyle="model"
                  />
                ))}
              </ProductCardGrid>
            </section>
          ) : null}
        </>
      ) : searchQuery && searchFallback ? (
        <SearchFallbackEmpty
          query={searchQuery}
          nearbySizes={searchFallback.nearby_sizes}
          relatedModels={searchFallback.related_models}
        />
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
              : isFlash
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
                  searchQuery
                    ? visit({}, { clearSearch: true })
                    : reset()
                }
              >
                {searchQuery
                  ? "Lihat semua model"
                  : "Hapus semua filter"}
              </Button>
            )
          }
        />
      )}
    </div>
  )

  const listingBody = (
    <ProductListingFrame
      // Judul halaman Flash Sale memakai label bergaya + hitung mundur, sama
      // seperti headline carousel Flash Sale (satu komponen bersama).
      title={isFlash ? <FlashSaleLabel /> : categoryName}
      titleRight={isFlash ? <FlashSaleCountdown period={period} /> : undefined}
      breadcrumbs={[
        { label: "Beranda", href: routeUrl("home") },
        ...(listingAllProducts
          ? [{ label: categoryName }]
          : [
              { label: "Model Produk", href: routeUrl("catalog.index") },
              { label: categoryName },
            ]),
      ]}
      toolbar={catalogNav}
      beforeChildren={fromTopSold && flashCarouselProducts.length > 0 ? (
        <FlashSaleCarouselSection products={flashCarouselProducts} />
      ) : null}
      pagination={products.length ? <Pagination pagination={pagination} /> : null}
    >
      {productGallery}
    </ProductListingFrame>
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

      {listingBody}

      {!isFlash && !isPromo && activeSort !== "popular" ? (
        <PalingBanyakDipesanSection products={popularProducts} />
      ) : null}
    </PublicLayout>
  )
}
