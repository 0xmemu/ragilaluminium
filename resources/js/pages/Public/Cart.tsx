import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

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


function optimisticItem(item: CartItem, quantity: number): CartItem {
  const unitPrice = Number(item.unit_price ?? 0)
  const comparePrice = Number(item.compare_price ?? item.unit_price ?? 0)
  const lineTotal = unitPrice * quantity
  const lineCompare = comparePrice * quantity

  return {
    ...item,
    quantity,
    line_total: lineTotal,
    line_compare_total: lineCompare,
    line_discount: Math.max(0, lineCompare - lineTotal),
  }
}
export default function Cart({
  items: initialItems = [],
  subtotal: _subtotal = 0,
  compare_subtotal: _compareSubtotal = 0,
  discount_total: _discountTotal = 0,
  undo_item: undoItem = null,
}: {
  items: CartItem[]
  subtotal: number
  compare_subtotal?: number
  discount_total?: number
  undo_item?: Record<string, unknown> | null
}) {
  const [cartItems, setCartItems] = React.useState<CartItem[]>(() => initialItems)

  React.useEffect(() => {
    // Cart props are refreshed by Inertia after a mutation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCartItems(initialItems)
  }, [initialItems])

  function updateLocalQuantity(lineId: string, quantity: number) {
    setCartItems((current) => current.map((item) =>
      item.line_id === lineId ? optimisticItem(item, quantity) : item
    ))
  }

  const [selectMode, setSelectMode] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const selectForm = useForm({ line_ids: [] as string[] })
  const deleteForm = useForm({ line_ids: [] as string[] })
  const restoreForm = useForm({})

  const allSelected = cartItems.length > 0 && selectedIds.size === cartItems.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < cartItems.length
  const noneSelected = selectedIds.size === 0

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(cartItems.map((it) => it.line_id)))
    }
  }

  function toggleOne(lineId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) {
        next.delete(lineId)
      } else {
        next.add(lineId)
      }
      return next
    })
  }

  function enterSelectMode() {
    setSelectMode(true)
    setSelectedIds(new Set())
    setConfirmDelete(false)
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
    setConfirmDelete(false)
  }

  // Checkout scope: semua item secara default; hanya item terpilih saat mode pilih.
  const effectiveItems = selectMode
    ? cartItems.filter((it) => selectedIds.has(it.line_id))
    : cartItems
  const selectedSubtotal = effectiveItems.reduce(
    (sum, it) => sum + (typeof it.line_total === "number" ? it.line_total : 0),
    0
  )
  const selectedCompare = effectiveItems.reduce(
    (sum, it) =>
      sum +
      (typeof it.line_compare_total === "number"
        ? it.line_compare_total
        : typeof it.line_total === "number"
          ? it.line_total
          : 0),
    0
  )
  const selectedDiscount = selectedCompare - selectedSubtotal
  const hasDiscount = selectedDiscount > 0

  const [confirmDelete, setConfirmDelete] = React.useState(false)

  function checkoutSelected(e: React.FormEvent) {
    e.preventDefault()
    const lineIds = selectMode ? [...selectedIds] : cartItems.map((it) => it.line_id)
    selectForm.setData("line_ids", lineIds)
    selectForm.post(routeUrl("cart.select"))
  }

  function deleteSelected(e: React.FormEvent) {
    e.preventDefault()
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    deleteForm.setData("line_ids", [...selectedIds])
    deleteForm.post(routeUrl("cart.remove-selected"), {
      onSuccess: () => setConfirmDelete(false),
    })
  }

  function cancelDelete() {
    setConfirmDelete(false)
  }

  return (
    <PublicLayout>
      <Head title="Keranjang" />

      <section className="border-b border-border bg-surface">
        <div className="container-page py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
              aria-label="Kembali"
            >
              <Icon name="arrow-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="text-base font-bold tracking-tight text-foreground">
              Keranjang
            </h1>
          </div>
        </div>
      </section>

      {undoItem ? (
        <div className="border-b border-border bg-accent/10">
          <div className="container-page flex items-center justify-between gap-3 py-2">
            <p className="min-w-0 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{String(undoItem.name ?? "Produk")}</span> dihapus dari keranjang
            </p>
            <Button
              type="button"
              variant="link"
              size="xs"
              className="shrink-0 px-0 text-xs"
              disabled={restoreForm.processing}
              onClick={() => restoreForm.post(routeUrl("cart.restore"))}
            >
              Urungkan
            </Button>
          </div>
        </div>
      ) : null}

      <section className={cartItems.length ? "container-page min-w-0 overflow-x-hidden !px-5 md:!px-8 lg:!px-12" : "container-page !px-5 md:!px-8 lg:!px-12"}>
        {cartItems.length ? (
          <div className="space-y-4">
            {/* Select bar */}
            <div className="flex items-center justify-between gap-3 border-b border-border pb-2.5">
              <div className="flex items-center gap-3">
                {selectMode ? (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected }}
                      onChange={toggleAll}
                      className="size-4 cursor-pointer rounded border-border accent-primary"
                    />
                    <span className="text-xs font-semibold text-foreground">
                      {allSelected
                        ? "Batalkan semua"
                        : someSelected
                          ? `${selectedIds.size}/${cartItems.length} dipilih`
                          : "Pilih semua"}
                    </span>
                  </label>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    className="h-7 gap-1 px-2.5 text-[11px]"
                    onClick={enterSelectMode}
                  >
                    <Icon name="check" className="size-3" aria-hidden="true" />
                    Pilih
                  </Button>
                )}
                {selectMode && selectedIds.size > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.size} item
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {selectMode && selectedIds.size > 0 ? (
                  <form onSubmit={deleteSelected} className="flex items-center gap-2">
                  {confirmDelete ? (
                    <>
                      <span className="text-xs font-semibold text-destructive">
                        Hapus {selectedIds.size} item?
                      </span>
                      <Button
                        type="submit"
                        variant="destructive"
                        size="xs"
                        className="h-7 px-2.5 text-[11px]"
                        disabled={deleteForm.processing}
                      >
                        Ya, hapus
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="h-7 px-2.5 text-[11px]"
                        onClick={cancelDelete}
                        disabled={deleteForm.processing}
                      >
                        Batal
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="submit"
                      variant="secondary"
                      size="xs"
                      className="h-7 gap-1 px-2 text-[11px] text-destructive border-destructive/30"
                    >
                      <Icon name="x" className="size-3" aria-hidden="true" />
                      Hapus ({selectedIds.size})
                    </Button>
                  )}
                </form>
                ) : null}
                {selectMode ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="h-7 px-2.5 text-[11px]"
                    onClick={exitSelectMode}
                    disabled={selectForm.processing || deleteForm.processing}
                  >
                    Selesai
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
              <div className="min-w-0">
                <div>
                  {cartItems.map((item) => (
                    <CartLineItem
                      key={item.line_id}
                      item={item}
                      selectable={selectMode}
                      selected={selectedIds.has(item.line_id)}
                      onToggle={() => toggleOne(item.line_id)}
                      onQuantityChange={(quantity) => updateLocalQuantity(item.line_id, quantity)}
                    />
                  ))}
                </div>
              </div>

              <aside className="surface-panel min-w-0 p-5 lg:sticky lg:top-28">
                <h2 className="text-lg font-semibold">Ringkasan</h2>
                <dl className="mt-4 space-y-3 text-xs">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">
                      Subtotal
                      {selectMode && selectedIds.size !== cartItems.length ? (
                        <span className="ml-1 text-xs">({selectedIds.size} item)</span>
                      ) : null}
                    </dt>
                    <dd className="tabular-nums font-semibold">{formatCurrency(selectedSubtotal)}</dd>
                  </div>
                  {hasDiscount ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Potongan harga</dt>
                      <dd className="tabular-nums font-semibold text-sale">
                        −{formatCurrency(selectedDiscount)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Pengiriman</dt>
                    <dd className="text-right font-semibold break-words">Dihitung saat checkout</dd>
                  </div>
                </dl>
                <div className="mt-4 border-t border-border pt-4">
                  <div className="flex items-end justify-between gap-4">
                    <p className="text-sm font-semibold">Subtotal saat ini</p>
                    <p className="tabular-nums text-lg font-bold">{formatCurrency(selectedSubtotal)}</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {hasDiscount
                      ? "Subtotal sudah termasuk potongan promo yang sedang berlaku."
                      : "Total akhir mengikuti biaya pengiriman dari alamat tujuan."}
                  </p>
                </div>
                <form onSubmit={checkoutSelected}>
                  <Button
                    type="submit"
                    size="md"
                    className="mt-4 hidden h-10 w-full lg:inline-flex text-sm"
                    disabled={(selectMode && noneSelected) || selectForm.processing}
                  >
                    {selectMode
                      ? noneSelected
                        ? "Pilih item terlebih dahulu"
                        : `Checkout (${selectedIds.size})`
                      : "Checkout"}
                    <Icon name="arrow-right" className="size-4" aria-hidden="true" />
                  </Button>
                </form>
                <TrustAssuranceCard className="mt-4" />
              </aside>
            </div>

            <TrustBadgesGrid />

            <MobileStickyCta aria-label="Lanjut checkout" spacerClassName="h-[4.5rem]">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs font-medium text-muted-foreground">
                  Subtotal {selectMode && selectedIds.size !== cartItems.length ? `(${selectedIds.size} item)` : ""}
                </span>
                <span className="tabular-nums text-sm font-bold leading-5">
                  {formatCurrency(selectedSubtotal)}
                </span>
              </div>
              <form onSubmit={checkoutSelected}>
                <Button
                  type="submit"
                  size="md"
                  className="h-10 min-h-10 shrink-0 px-5 text-sm"
                  disabled={(selectMode && noneSelected) || selectForm.processing}
                >
                  {selectMode
                    ? noneSelected
                      ? "Pilih item"
                      : `Checkout (${selectedIds.size})`
                    : "Checkout"}
                  <Icon name="arrow-right" className="size-4" aria-hidden="true" />
                </Button>
              </form>
            </MobileStickyCta>
          </div>
        ) : (
          <EmptyState
            icon="shopping-cart"
            title="Keranjang masih kosong"
            description="Pilih model yang sesuai, tentukan varian, lalu tambahkan produk ke keranjang."
            action={
              <Button asChild size="md">
                <Link href={routeUrl("catalog.index")}>
                  Pilih model produk
                  <Icon name="arrow-right" className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        )}
      </section>
    </PublicLayout>
  )
}
