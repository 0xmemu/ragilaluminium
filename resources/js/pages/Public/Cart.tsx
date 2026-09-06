import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { CartLineItem } from "@/components/public/cart-line-item"
import { CartCheckoutSummary } from "@/components/public/cart-checkout-summary"
import { TrustAssuranceCard } from "@/components/public/trust-assurance-card"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { EmptyState } from "@/components/ui/empty-state"
import PublicLayout from "@/layouts/public-layout"
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
  undo_count: initialUndoCount = 0,
}: {
  items: CartItem[]
  subtotal: number
  compare_subtotal?: number
  discount_total?: number
  /** Jumlah item yang baru dihapus dan masih bisa diurungkan (window 5 dtk). */
  undo_count?: number
}) {
  const [cartItems, setCartItems] = React.useState<CartItem[]>(() => initialItems)

  React.useEffect(() => {
    // Cart props are refreshed by Inertia after a mutation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCartItems(initialItems)
  }, [initialItems])

  function updateLocalQuantity(lineId: string, quantity: number) {
    setCartItems((current) =>
      current.map((item) => (item.line_id === lineId ? optimisticItem(item, quantity) : item)),
    )
  }

  // Fitur pilih tidak aktif secara default. Aktif hanya saat tombol Pilih ditekan.
  const [selectMode, setSelectMode] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  function enterSelectMode() {
    setSelectMode(true)
    setSelectedIds(new Set())
  }
  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  React.useEffect(() => {
    if (!selectMode) setSelectedIds(new Set())
  }, [initialItems, selectMode])

  const allSelected = cartItems.length > 0 && selectedIds.size === cartItems.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < cartItems.length
  const noneSelected = selectedIds.size === 0

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(cartItems.map((it) => it.line_id)))
  }

  function toggleOne(lineId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  // Ringkasan: semua item saat mode pilih non-aktif; hanya item tercentang saat aktif.
  const scoped = selectMode ? cartItems.filter((it) => selectedIds.has(it.line_id)) : cartItems
  const selectedSubtotal = scoped.reduce((sum, it) => sum + (typeof it.line_total === "number" ? it.line_total : 0), 0)
  const selectedCompare = scoped.reduce((sum, it) => {
    const v = typeof it.line_compare_total === "number"
      ? it.line_compare_total
      : typeof it.line_total === "number"
        ? it.line_total
        : 0
    return sum + v
  }, 0)
  const selectedDiscount = Math.max(0, selectedCompare - selectedSubtotal)

  const submitForm = useForm({ line_ids: [] as string[] })
  const removeSelectedForm = useForm({ line_ids: [] as string[] })
  const undoForm = useForm({})
  const [showUndoToast, setShowUndoToast] = React.useState(false)

  React.useEffect(() => {
    if (initialUndoCount <= 0) {
      setShowUndoToast(false)
      return
    }
    setShowUndoToast(true)
    const timer = window.setTimeout(() => setShowUndoToast(false), 5000)
    return () => window.clearTimeout(timer)
  }, [initialUndoCount])

  function checkoutSelected(e: React.FormEvent) {
    e.preventDefault()
    const lineIds = selectMode ? [...selectedIds] : cartItems.map((it) => it.line_id)
    submitForm.setData("line_ids", lineIds)
    submitForm.post(routeUrl("cart.select"))
  }

  function removeSelected() {
    const lineIds = allSelected
      ? cartItems.map((it) => it.line_id)
      : [...selectedIds]
    if (!lineIds.length) return
    removeSelectedForm.setData("line_ids", lineIds)
    removeSelectedForm.post(routeUrl("cart.remove-selected"))
  }

  return (
    <PublicLayout>
      <Head title="Keranjang" />

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden md:block py-2 !px-2.5 md:!px-8 lg:!px-12">
          <Breadcrumbs items={[{ label: "Beranda", href: routeUrl("home") }, { label: "Keranjang" }]} />
        </div>
        <div className="container-page py-2 !px-2.5 md:!px-8 lg:!px-12">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center lg:hidden"
              aria-label="Kembali"
            >
              <Icon name="arrow-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="text-base font-bold tracking-tight text-foreground">
              Keranjang{cartItems.length > 0 ? ` (${cartItems.reduce((sum, it) => sum + (typeof it.quantity === "number" ? it.quantity : 1), 0)})` : ""}
            </h1>
          </div>
        </div>
      </section>

      {cartItems.length ? (
        <div className="border-b border-border bg-surface">
          <div className="mx-auto flex w-full max-w-[80rem] items-center justify-between gap-3 !px-2.5 md:!px-8 lg:!px-12 py-2">
            {selectMode ? (
              <label
                className="flex min-w-0 cursor-pointer select-none items-center gap-2.5"
                style={{ animation: "cart-label-slide 0.22s ease-out" }}
              >
                <span className="relative inline-flex shrink-0">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={toggleAll}
                    className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none flex size-[22px] items-center justify-center rounded-[3px] border border-border bg-white text-white transition peer-checked:border-primary peer-checked:bg-primary peer-checked:[&_svg]:opacity-100"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      className="size-[70%] opacity-0 transition"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                    </svg>
                  </span>
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {allSelected ? "Semua dipilih" : someSelected ? `${selectedIds.size}/${cartItems.length} dipilih` : "Pilih semua"}
                </span>
              </label>
            ) : (
              <button
                type="button"
                onClick={enterSelectMode}
                className="shrink-0 text-xs font-semibold text-primary transition hover:opacity-80"
              >
                Pilih
              </button>
            )}
            <span className="shrink-0 text-xs text-muted-foreground">
              {selectMode ? `${selectedIds.size} item` : `${cartItems.length} item`}
            </span>
            {selectMode ? (
              <span className="flex shrink-0 items-center gap-4" style={{ animation: "cart-count-slide 0.24s ease-out 0.05s" }}>
                <button
                  type="button"
                  onClick={removeSelected}
                  disabled={noneSelected || removeSelectedForm.processing}
                  className="shrink-0 text-xs font-semibold text-destructive transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {allSelected ? "Hapus semua" : "Hapus"}
                </button>
                <button
                  type="button"
                  onClick={exitSelectMode}
                  className="shrink-0 text-xs font-semibold text-muted-foreground underline-offset-2 transition hover:underline"
                >
                  Selesai
                </button>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="container-page !px-2.5 md:!px-8 lg:!px-12">
        {cartItems.length ? (
          <div className="space-y-3 py-3">
            {/* Item list - padding antar kartu */}
            <div className="flex flex-col gap-2">
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

            <TrustAssuranceCard />

            {/* Satu sumber ringkasan+CTA: desktop lg+ pakai panel, mobile pakai ringkasan flat;
                 sticky bawah mobile lewat variant sticky di MobileStickyCta. Perilaku tombol
                 (checkoutSelected, disabled, label) satu sumber di CartCheckoutSummary. */}
            <div className="hidden lg:block border-t border-border pt-3">
              <CartCheckoutSummary
                variant="panel"
                itemCount={selectMode ? selectedIds.size : cartItems.length}
                subtotal={selectedSubtotal}
                discount={selectedDiscount}
                disabled={selectMode && noneSelected}
                processing={submitForm.processing}
                onSubmit={checkoutSelected}
              />
            </div>
            {/* Mobile: checkout cukup lewat sticky bar bawah (MobileStickyCta) - tanpa panel inline dobel */}

            <CartCheckoutSummary
              variant="sticky"
              itemCount={selectMode ? selectedIds.size : cartItems.length}
              subtotal={selectedSubtotal}
              discount={selectedDiscount}
              disabled={selectMode && noneSelected}
              processing={submitForm.processing}
              onSubmit={checkoutSelected}
            />
          </div>
        ) : (
          <div className="py-8">
            <EmptyState
              icon="shopping-cart"
              title="Keranjang masih kosong"
              description="Pilih model yang sesuai, tentukan varian, lalu tambahkan produk ke keranjang."
              action={
                <Button asChild size="md">
                  <Link href={routeUrl("catalog.index")}>
                    Pilih Model Produk
                    <Icon name="arrow-right" className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              }
            />
          </div>
        )}
      </section>

      {showUndoToast && initialUndoCount > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-[60] flex justify-center px-4">
          <div className="pointer-events-auto flex w-auto max-w-full items-center gap-3 rounded-xl border border-destructive/70 bg-destructive/10 px-4 py-3 shadow-[0_8px_24px_rgba(10,0,0,0.14)]">
            <Icon name="trash" className="size-5 shrink-0 text-destructive" aria-hidden="true" />
            <span className="shrink-0 text-xs font-semibold text-destructive">
              produk dihapus dari keranjang
            </span>
            <button
              type="button"
              onClick={() => undoForm.post(routeUrl("cart.restore"))}
              disabled={undoForm.processing}
              className="shrink-0 rounded-full border border-destructive px-3 py-1 text-xs font-bold text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Urungkan
            </button>
          </div>
        </div>
      ) : null}
    </PublicLayout>
  )
}
