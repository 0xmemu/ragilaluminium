import { Head, Link } from "@inertiajs/react"

import { CartLineItem } from "@/components/public/cart-line-item"
import { MobileStickyCta } from "@/components/public/mobile-sticky-cta"
import { TrustAssuranceCard } from "@/components/public/trust-assurance-card"
import { TrustBadgesGrid } from "@/components/public/trust-badges-grid"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import PublicLayout from "@/layouts/public-layout"
import { formatCurrency } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { CartItem } from "@/types"

export default function Cart({
  items = [],
  subtotal = 0,
  compare_subtotal: _compareSubtotal = 0,
  discount_total = 0,
}: {
  items: CartItem[]
  subtotal: number
  compare_subtotal?: number
  discount_total?: number
}) {
  const hasDiscount = discount_total > 0

  return (
    <PublicLayout>
      <Head title="Keranjang" />

      <section className="border-b border-border bg-surface">
        <div className="container-page py-12 lg:py-16">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Periksa produk pilihan Anda
          </h1>
        </div>
      </section>

      <section className={items.length ? "container-page pb-10 pt-0 lg:pb-14" : "container-page py-10 lg:py-14"}>
        {items.length ? (
          <div className="space-y-10">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-14">
              <div>
                <div>
                  {items.map((item) => (
                    <CartLineItem key={item.line_id} item={item} />
                  ))}
                </div>
                <Button asChild variant="link" className="mt-6">
                  <Link href={routeUrl("catalog.index")}>
                    <Icon name="arrow-left" className="h-4 w-4" aria-hidden="true" />
                    Lanjut memilih produk
                  </Link>
                </Button>
              </div>

              <aside className="surface-panel p-6 lg:sticky lg:top-28">
                <h2 className="text-2xl font-semibold">Ringkasan</h2>
                <dl className="mt-6 space-y-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="tabular-nums font-semibold">{formatCurrency(subtotal)}</dd>
                  </div>
                  {hasDiscount ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Potongan harga</dt>
                      <dd className="tabular-nums font-semibold text-sale">
                        −{formatCurrency(discount_total)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Pengiriman</dt>
                    <dd className="text-right font-semibold">Dihitung saat checkout</dd>
                  </div>
                </dl>
                <div className="mt-6 border-t border-border pt-5">
                  <div className="flex items-end justify-between gap-4">
                    <p className="font-semibold">Subtotal saat ini</p>
                    <p className="tabular-nums text-xl font-bold">{formatCurrency(subtotal)}</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {hasDiscount
                      ? "Subtotal sudah termasuk potongan promo yang sedang berlaku."
                      : "Total akhir mengikuti biaya pengiriman yang dihitung dari alamat tujuan."}
                  </p>
                </div>
                <Button asChild size="lg" className="mt-6 hidden h-12 w-full lg:inline-flex">
                  <Link href={routeUrl("checkout.index")}>
                    Lanjut ke checkout
                    <Icon name="arrow-right" className="h-5 w-5" aria-hidden="true" />
                  </Link>
                </Button>
                <TrustAssuranceCard className="mt-5" />
              </aside>
            </div>

            <TrustBadgesGrid />

            <MobileStickyCta aria-label="Lanjut checkout" spacerClassName="h-[4.5rem]">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[11px] font-medium text-muted-foreground">Subtotal</span>
                <span className="tabular-nums text-base font-bold leading-5">{formatCurrency(subtotal)}</span>
              </div>
              <Button asChild size="lg" className="h-11 min-h-11 shrink-0 px-5">
                <Link href={routeUrl("checkout.index")}>
                  Checkout
                  <Icon name="arrow-right" className="h-5 w-5" aria-hidden="true" />
                </Link>
              </Button>
            </MobileStickyCta>
          </div>
        ) : (
          <EmptyState
            icon="shopping-cart"
            title="Keranjang masih kosong"
            description="Pilih model yang sesuai, tentukan varian, lalu tambahkan produk ke keranjang."
            action={
              <Button asChild size="lg">
                <Link href={routeUrl("catalog.index")}>
                  Pilih model produk
                  <Icon name="arrow-right" className="h-5 w-5" aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        )}
      </section>
    </PublicLayout>
  )
}
