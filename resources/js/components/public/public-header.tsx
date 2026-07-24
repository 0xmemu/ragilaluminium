import { Link, router, usePage } from "@inertiajs/react"
import * as React from "react"

import { BrandWordmark } from "@/components/shared/brand-wordmark"
import { Icon } from "@/components/shared/icon"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { useRotatingPlaceholder } from "@/hooks/use-rotating-placeholder"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { isRouteActive, routeUrl } from "@/lib/routes"
import type { RouteNavItem, SharedPageProps } from "@/types"

function navHref(item: RouteNavItem): string {
  const base = routeUrl(item.route, item.params)
  return item.hash ? `${base}#${item.hash}` : base
}

function HeaderSearchForm({
  className,
  inputClassName,
}: {
  className?: string
  inputClassName?: string
}) {
  const [query, setQuery] = React.useState("")
  const [focused, setFocused] = React.useState(false)
  const placeholder = useRotatingPlaceholder(Boolean(query.trim()) || focused)

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault()
        const value = query.trim()
        if (value.length < 2) return
        router.get(routeUrl("catalog.index"), { q: value })
      }}
    >
      <div className="relative w-full">
        <Icon
          name="search"
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-background/55 md:left-4 md:size-5"
          aria-hidden="true"
        />
        <input
          name="q"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className={cn(
            "h-9 w-full rounded-full border-0 bg-white/10 py-1.5 pl-8 pr-3 text-sm text-background outline-none ring-0 placeholder:text-background/55 placeholder:transition-opacity focus:bg-white/15 focus:ring-1 focus:ring-white/40 md:h-11 md:pl-12 md:pr-5 md:text-base",
            inputClassName,
          )}
          aria-label="Cari produk"
        />
      </div>
    </form>
  )
}

export function PublicHeader() {
  const page = usePage<SharedPageProps>()
  const { cartCount, cartPreview, nav, flashSalePeriod } = page.props
  const previewItems = cartPreview ?? []
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [modelsOpen, setModelsOpen] = React.useState(false)
  const [cartPreviewOpen, setCartPreviewOpen] = React.useState(false)
  const menuItems = nav?.public?.hamburger ?? []
  const modelItems = nav?.public?.model_menu ?? []
  const desktopItems = nav?.public?.desktop_main ?? []
  const primaryItems = menuItems.slice(0, 2)
  const secondaryItems = menuItems.slice(2)
  const flashLive = flashSalePeriod?.live === true
  const isAllProductsListing =
    isRouteActive(["catalog.windows", "catalog.doors", "catalog.bouven", "product.show", "search"]) ||
    (isRouteActive(["catalog.index"]) && /[?&](sort|q|model|price_min|price_max)=/.test(page.url))
  const modelGroups = React.useMemo(
    () =>
      [
        ["WINDOW", "Jendela"],
        ["DOOR", "Pintu"],
        ["BOUVEN", "Boven"],
      ]
        .map(([category, label]) => ({
          category,
          label,
          items: modelItems.filter((item) => item.category === category),
        }))
        .filter((group) => group.items.length),
    [modelItems],
  )

  React.useEffect(() => {
    if (!menuOpen) setModelsOpen(false)
  }, [menuOpen])

  return (
    <>
    <header className="sticky top-0 z-header border-b border-white/10 bg-foreground text-background">
      <div className="container-page relative flex h-14 items-center gap-1.5 py-0 md:min-h-14 md:gap-0 md:py-2">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="relative z-20 -ml-1.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-background transition-colors hover:bg-white/10 active:bg-white/20 md:size-11"
              aria-label="Buka menu utama"
            >
              <Icon name="menu" className="size-5 md:size-6" weight="bold" aria-hidden="true" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className={cn(
              "safe-bottom !border-0 p-0 !shadow-none [&>button]:left-4 [&>button]:right-auto [&>button]:top-4",
              modelsOpen ? "!w-[min(94vw,48rem)]" : "!w-[min(94vw,24rem)]",
            )}
          >
            <div className="px-16 py-4">
              <BrandWordmark className="mx-auto w-fit" />
              <SheetTitle className="sr-only">Menu utama</SheetTitle>
              <SheetDescription className="sr-only">
                Jelajahi model, produk, promo, dan layanan Ragil Aluminium.
              </SheetDescription>
            </div>

            <div className="grid min-h-[calc(100dvh-4.5rem)] md:grid-cols-[minmax(17rem,20rem)_1fr]">
              <nav
                className="overflow-y-auto px-6 py-8 sm:px-10 md:px-12"
                aria-label="Menu utama"
              >
                <div className="grid gap-1">
                  {primaryItems.map((item, index) => {
                    const isModels = index === 0
                    const active = isModels
                      ? isRouteActive(["catalog.index"]) && !isAllProductsListing
                      : isAllProductsListing

                    return (
                      <div
                        key={`${item.label}-${item.route}`}
                        className="group flex items-center"
                        onMouseEnter={isModels ? () => setModelsOpen(true) : undefined}
                        onFocus={isModels ? () => setModelsOpen(true) : undefined}
                      >
                        <Link
                          href={navHref(item)}
                          onClick={() => setMenuOpen(false)}
                          className={cn(
                            "flex min-h-16 min-w-0 flex-1 items-center font-display text-2xl font-bold leading-tight transition sm:text-3xl",
                            active ? "text-primary" : "text-foreground hover:text-primary",
                          )}
                          aria-current={active ? "page" : undefined}
                        >
                          {item.label}
                        </Link>
                        {isModels && modelItems.length ? (
                          <button
                            type="button"
                            onClick={() => setModelsOpen((open) => !open)}
                            className="inline-flex size-11 shrink-0 items-center justify-center text-foreground transition hover:bg-muted md:hidden"
                            aria-label={modelsOpen ? "Tutup daftar model" : "Buka daftar model"}
                            aria-expanded={modelsOpen}
                          >
                            <Icon
                              name="caret-right"
                              className={cn("size-5 transition-transform", modelsOpen && "rotate-90")}
                              weight="bold"
                              aria-hidden="true"
                            />
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-8 grid gap-0.5" onMouseEnter={() => setModelsOpen(false)}>
                  {secondaryItems.map((item) => {
                    const active = !item.hash && isRouteActive(item.active ?? [item.route])
                    const isFlashSale = item.route === "catalog.flash-sale"
                    return (
                      <Link
                        key={`${item.label}-${item.route}-${item.hash ?? ""}`}
                        href={navHref(item)}
                        onClick={() => setMenuOpen(false)}
                        className={cn(
                          "inline-flex min-h-12 items-center gap-2 text-base font-semibold transition",
                          isFlashSale
                            ? "text-sale hover:text-foreground"
                            : active
                              ? "text-primary"
                              : "text-foreground hover:text-primary",
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        {item.icon ? (
                          <Icon
                            name={item.icon}
                            className={cn("size-4", item.icon === "lightning" && "text-sale")}
                            weight={item.icon === "lightning" ? "fill" : "bold"}
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className={cn(isFlashSale && "font-extrabold italic")}>
                          {item.label}
                        </span>
                        {isFlashSale && flashLive ? (
                          <span className="rounded bg-sale px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tight text-white">
                            Live
                          </span>
                        ) : null}
                      </Link>
                    )
                  })}
                </div>
              </nav>

              <div
                className={cn(
                  "bg-surface px-6 py-7 sm:px-10 md:px-8 md:py-9",
                  modelsOpen ? "block" : "hidden",
                )}
                aria-hidden={!modelsOpen ? "true" : undefined}
              >
                <p className="mb-5 text-xs font-bold text-muted-foreground">
                  Model tersedia
                </p>
                {modelGroups.length ? (
                  <div className="grid gap-6">
                    {modelGroups.map((group) => (
                      <section key={group.category}>
                        <h3 className="mb-2 text-sm font-bold text-foreground">{group.label}</h3>
                        <div className="grid gap-1">
                          {group.items.map((model) => (
                            <Link
                              key={`${model.category}-${model.label}`}
                              href={model.href}
                              onClick={() => setMenuOpen(false)}
                              className="inline-flex min-h-9 items-center text-sm font-medium text-muted-foreground transition hover:translate-x-1 hover:text-primary focus-visible:text-primary"
                            >
                              {model.label}
                            </Link>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Model produk akan tampil setelah katalog tersedia.
                  </p>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Mobile: emblem beside search. Desktop: wordmark (narrows on mid widths). */}
        <BrandWordmark mark variant="dark" className="relative z-20 md:hidden" />
        <BrandWordmark
          compact
          variant="dark"
          className="relative z-20 hidden min-w-0 shrink md:inline-flex [&_img]:max-w-[7.5rem] lg:[&_img]:max-w-[10.5rem] xl:[&_img]:max-w-none"
        />

        {/* Mobile: flex search. Desktop: centered bar that yields space to side actions. */}
        <HeaderSearchForm className="relative z-20 min-w-0 flex-1 md:hidden" />
        <HeaderSearchForm className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden w-[min(36rem,calc(100%-17rem))] max-w-2xl -translate-x-1/2 -translate-y-1/2 px-3 lg:w-[min(42rem,calc(100%-22rem))] lg:px-4 xl:w-[min(42rem,calc(100%-26rem))] md:block [&>div]:pointer-events-auto" />

        <div className="relative z-20 ml-auto flex shrink-0 items-center justify-end gap-0.5 md:gap-1 lg:gap-2">
          <Link
            href={routeUrl("order.status")}
            className="relative hidden size-11 shrink-0 items-center justify-center gap-1.5 rounded-full text-background transition-colors hover:bg-white/10 active:bg-white/20 md:inline-flex lg:min-w-11 lg:px-3"
            aria-label="Pesanan"
            aria-current={isRouteActive(["order.status"]) ? "page" : undefined}
          >
            <Icon name="clipboard-list" className="size-6 shrink-0 lg:size-7" aria-hidden="true" />
            <span className="hidden text-xs font-bold lg:inline">Pesanan</span>
          </Link>
          <div
            className="relative shrink-0"
            onMouseEnter={() => setCartPreviewOpen(true)}
            onMouseLeave={() => setCartPreviewOpen(false)}
            onFocusCapture={() => setCartPreviewOpen(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setCartPreviewOpen(false)
              }
            }}
          >
            <Link
              href={routeUrl("cart.index")}
              className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-background transition-colors hover:bg-white/10 active:bg-white/20 md:size-11 lg:min-w-11 lg:gap-1.5 lg:px-3"
              aria-label={`Keranjang, ${cartCount ?? 0} barang`}
              aria-expanded={cartPreviewOpen}
              aria-controls="cart-hover-preview"
            >
              <span className="relative inline-flex shrink-0">
                <Icon name="shopping-cart" className="size-5 md:size-6 lg:size-7" aria-hidden="true" />
                {cartCount > 0 ? (
                  <span className="tabular-nums absolute -right-1 -top-1 flex min-h-3.5 min-w-3.5 items-center justify-center rounded-full bg-sale px-0.5 text-[8px] font-bold leading-none text-white md:-right-0.5 md:-top-0.5 md:min-h-4 md:min-w-4 md:px-1 md:text-[9px]">
                    {Math.min(cartCount, 99)}
                  </span>
                ) : null}
              </span>
              <span className="hidden text-xs font-bold lg:inline">Keranjang</span>
            </Link>

            <div
              id="cart-hover-preview"
              className={cn(
                "absolute right-[-12px] top-full z-[70] hidden w-[360px] pt-2 transition duration-150 md:block",
                cartPreviewOpen
                  ? "visible translate-y-0 opacity-100"
                  : "invisible -translate-y-1 opacity-0",
              )}
              aria-hidden={!cartPreviewOpen}
            >
              <div className="border border-[#dfdfdf] bg-white shadow-[0_8px_24px_rgba(10,0,0,0.16)]">
                {previewItems.length > 0 ? (
                  <>
                    <div className="flex min-h-[72px] items-center justify-between bg-primary px-3 py-6 text-white">
                      <p className="text-base font-semibold leading-[1.2]">Keranjang belanja</p>
                      <button
                        type="button"
                        onClick={() => setCartPreviewOpen(false)}
                        className="inline-flex size-8 items-center justify-center rounded-full text-2xl font-bold leading-none text-white transition-colors hover:bg-white/15 active:bg-white/25"
                        aria-label="Tutup ringkasan keranjang"
                      >
                        ×
                      </button>
                    </div>
                    <div className="min-h-[68px] bg-white p-3">
                      <ul className="grid max-h-[19rem] gap-3 overflow-y-auto">
                        {previewItems.map((item) => (
                          <li key={item.line_id} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3">
                            <Link href={routeUrl("product.show", { parent_sku: item.parent_sku })} tabIndex={-1}>
                              <ResponsiveImage
                                src={item.image}
                                alt={item.name}
                                wrapperClassName="aspect-square border border-border bg-white"
                                className="object-contain p-1"
                              />
                            </Link>
                            <div className="min-w-0">
                              <Link
                                href={routeUrl("product.show", { parent_sku: item.parent_sku })}
                                className="line-clamp-2 text-sm font-semibold leading-5 text-foreground hover:text-primary"
                              >
                                {item.name}
                              </Link>
                              {item.variation ? (
                                <p className="truncate text-xs text-muted-foreground">{item.variation}</p>
                              ) : null}
                              <p className="tabular-nums text-xs text-[#484848]">
                                {item.quantity} × {formatCurrency(item.unit_price)}
                              </p>
                            </div>
                          </li>
                        ))}
                        {cartCount > previewItems.reduce((total, item) => total + item.quantity, 0) ? (
                          <li className="text-xs text-muted-foreground">
                            Dan produk lainnya di keranjang belanja Anda.
                          </li>
                        ) : null}
                      </ul>
                    </div>
                    <div className="bg-white p-3">
                      <Link
                        href={routeUrl("cart.index")}
                        className="inline-flex min-h-[55px] w-full items-center justify-center rounded-full bg-primary px-8 text-sm font-bold text-white transition hover:bg-primary/90"
                      >
                        Lihat keranjang
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center px-6 py-10 text-center">
                    <div className="relative flex size-40 items-center justify-center rounded-full bg-muted">
                      <Icon
                        name="shopping-cart"
                        className="size-16 text-muted-foreground"
                        weight="light"
                        aria-hidden="true"
                      />
                      <Icon name="sparkle" weight="fill" className="absolute left-6 top-7 size-4 text-border" aria-hidden="true" />
                      <Icon name="sparkle" weight="fill" className="absolute bottom-9 right-7 size-5 text-border" aria-hidden="true" />
                    </div>
                    <p className="mt-6 text-base font-bold text-foreground">Keranjang belanja kosong.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Mulai isi dengan produk favorit Anda.
                    </p>
                    <Link
                      href={routeUrl("catalog.index")}
                      onClick={() => setCartPreviewOpen(false)}
                      className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-semibold text-background transition hover:bg-foreground/90"
                    >
                      Lihat produk baru
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    {desktopItems.length ? (
      <nav className="hidden border-b border-white/10 bg-foreground text-background md:block" aria-label="Navigasi utama">
        <div className="container-page flex min-h-11 items-center justify-center gap-7 lg:gap-10">
          {desktopItems.map((item) => {
            const listingActive =
              isRouteActive(["catalog.windows", "catalog.doors", "catalog.bouven", "product.show"]) ||
              (isRouteActive(["catalog.index"]) &&
                /[?&](sort|q|model|price_min|price_max)=/.test(page.url))
            const modelHubActive =
              isRouteActive(["catalog.index"]) &&
              !/[?&](sort|q|model|price_min|price_max)=/.test(page.url)
            const isFlashSale = item.route === "catalog.flash-sale"

            let active = isRouteActive(item.active ?? [item.route])
            if (item.route === "catalog.index" && item.params?.sort === "newest") {
              active = listingActive
            } else if (item.route === "catalog.index" && !item.params) {
              active = modelHubActive
            }

            return (
              <Link
                key={`${item.label}-${item.route}-${item.hash ?? ""}`}
                href={navHref(item)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold transition",
                  isFlashSale
                    ? cn(
                        "font-extrabold italic text-sale hover:text-white",
                        active && "text-sale",
                      )
                    : cn(
                        "hover:text-background",
                        active ? "text-[#ff8a8a]" : "text-[#c8cdc9]",
                      ),
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.icon ? (
                  <Icon
                    name={item.icon}
                    className="size-4 shrink-0"
                    weight={item.icon === "lightning" ? "fill" : "bold"}
                    aria-hidden="true"
                  />
                ) : null}
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    ) : null}
    </>
  )
}
