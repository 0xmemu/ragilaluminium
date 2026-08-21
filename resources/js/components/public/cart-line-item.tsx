import { Link, useForm, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { QuantityControl } from "@/components/ui/quantity-control"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { dispatchCartUpdated } from "@/lib/cart-events"
import { formatCurrency, productName } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { CartItem, SharedPageProps } from "@/types"

function money(value: number | string | null | undefined): number {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

export function CartLineItem({ item, selected, onToggle, onQuantityChange, selectable = true }: { item: CartItem; selected: boolean; onToggle: () => void; onQuantityChange: (quantity: number) => void; selectable?: boolean }) {
  const page = usePage<SharedPageProps>()
  const removeForm = useForm({ line_id: item.line_id })
  const [saving, setSaving] = React.useState(false)
  const [updateError, setUpdateError] = React.useState<string | null>(null)
  const timer = React.useRef<number | null>(null)
  const quantityAbortRef = React.useRef<AbortController | null>(null)
  const sequence = React.useRef(0)
  const latestQuantity = React.useRef(item.quantity)
  const confirmedQuantity = React.useRef(item.quantity)

  // Catatan per-produk (keputusan #11): disimpan debounce ke /cart/update.
  const [note, setNote] = React.useState(item.note ?? "")
  const [noteSaving, setNoteSaving] = React.useState(false)
  const [noteError, setNoteError] = React.useState<string | null>(null)
  const noteTimer = React.useRef<number | null>(null)
  const noteAbortRef = React.useRef<AbortController | null>(null)
  const noteDraft = React.useRef(item.note ?? "")

  React.useEffect(() => {
    noteDraft.current = item.note ?? ""
    // Sync state catatan dengan prop terbaru (data dari server / item lain).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNote(item.note ?? "")
  }, [item.note])


  React.useEffect(() => {
    if (!saving && timer.current === null && latestQuantity.current !== item.quantity) {
      latestQuantity.current = item.quantity
      confirmedQuantity.current = item.quantity
    }
  }, [item.quantity, saving])

  React.useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    if (noteTimer.current !== null) window.clearTimeout(noteTimer.current)
    quantityAbortRef.current?.abort()
    noteAbortRef.current?.abort()
  }, [])

  const unitPrice = money(item.unit_price)
  const comparePrice = item.compare_price == null ? null : money(item.compare_price)
  const lineTotal = money(item.line_total)
  const lineDiscount = money(item.line_discount)
  const hasDiscount =
    lineDiscount > 0 || (comparePrice !== null && comparePrice > unitPrice)
  const lineCompare =
    item.line_compare_total != null
      ? money(item.line_compare_total)
      : hasDiscount && comparePrice !== null
        ? comparePrice * item.quantity
        : lineTotal
  const discountPercent =
    item.discount_percent ??
    (comparePrice && comparePrice > 0 && unitPrice < comparePrice
      ? Math.round(((comparePrice - unitPrice) / comparePrice) * 100)
      : null)

  function updateQuantity(quantity: number) {
    latestQuantity.current = quantity
    sequence.current += 1
    const currentSequence = sequence.current
    setUpdateError(null)
    onQuantityChange(quantity)

    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      void persistQuantity(quantity, currentSequence)
    }, 220)
  }

  async function persistNote(value: string) {
    // §8: request baru membatalkan yang masih berjalan (ketik cepat → response basi tidak menimpa).
    noteAbortRef.current?.abort()
    const controller = new AbortController()
    noteAbortRef.current = controller
    try {
      const response = await fetch(routeUrl("cart.update"), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": page.props.csrf,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ line_id: item.line_id, quantity: latestQuantity.current, note: value }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error("Cart note update failed")
    } catch (_error) {
      if (controller.signal.aborted) return
      setNoteError("Gagal menyimpan catatan. Coba lagi.")
    } finally {
      if (!controller.signal.aborted) setNoteSaving(false)
    }
  }

  function updateNote(value: string) {
    setNote(value)
    noteDraft.current = value
    setNoteError(null)
    if (noteTimer.current !== null) window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(() => {
      noteTimer.current = null
      setNoteSaving(true)
      void persistNote(value.trim())
    }, 450)
  }

  async function persistQuantity(quantity: number, currentSequence: number) {
    setSaving(true)

    quantityAbortRef.current?.abort()
    const controller = new AbortController()
    quantityAbortRef.current = controller

    try {
      const response = await fetch(routeUrl("cart.update"), {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": page.props.csrf,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ line_id: item.line_id, quantity }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error("Cart update failed")

      const result = await response.json() as { line_id: string; quantity: number; stock: number; cart_count: number }
      if (controller.signal.aborted || currentSequence !== sequence.current) return

      confirmedQuantity.current = result.quantity
      latestQuantity.current = result.quantity
      onQuantityChange(result.quantity)
      dispatchCartUpdated({
        lineId: result.line_id,
        quantity: result.quantity,
        count: result.cart_count,
      })
    } catch (_error) {
      if (controller.signal.aborted) return
      if (currentSequence === sequence.current) {
        latestQuantity.current = confirmedQuantity.current
        onQuantityChange(confirmedQuantity.current)
        setUpdateError("Gagal memperbarui jumlah. Silakan coba lagi.")
      }
    } finally {
      if (!controller.signal.aborted && currentSequence === sequence.current) setSaving(false)
    }
  }

  const discountBadge = discountPercent ? (
    <span className="rounded bg-accent px-1 text-[11px] font-semibold leading-4 text-accent-foreground">
      −{discountPercent}%
    </span>
  ) : null

  const flashSaleBadge = item.flash_sale ? (
    <span className="inline-flex items-center gap-0.5">
      <Icon name="lightning" weight="fill" className="size-3 shrink-0 text-sale" aria-hidden />
      <span className="text-[11px] font-extrabold italic tracking-tight text-sale">FLASH SALE</span>
    </span>
  ) : null

  const priceBlock = (
    <div className="text-left">
      {hasDiscount ? (
        <>
          {/* Satu baris: harga jual (kiri) · harga coret · label diskon */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <p className="tabular-nums text-[13px] font-bold leading-4 text-sale">
              {formatCurrency(lineTotal)}
            </p>
            <p className="tabular-nums text-xs leading-4 text-muted-foreground line-through">
              {formatCurrency(lineCompare)}
            </p>
            {discountBadge}
          </div>
          {/* Flash Sale satu baris dgn Hemat, paling kiri */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {flashSaleBadge}
            <p className="text-xs font-semibold leading-3 text-destructive/60">
              Hemat {formatCurrency(lineDiscount || lineCompare - lineTotal)}
            </p>
          </div>
        </>
      ) : (
        <p className="tabular-nums text-[13px] font-bold leading-4 text-sale">
          {formatCurrency(lineTotal)}
        </p>
      )}
    </div>
  )

  const quantityControls = (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => updateQuantity(Math.max(1, item.quantity - 1))}
          disabled={removeForm.processing || item.quantity <= 1}
          aria-label="Kurangi jumlah"
        >
          <Icon name="minus" className="size-3" aria-hidden="true" />
        </button>
        <span
          className="flex h-6 min-w-[24px] items-center justify-center border border-border px-1 text-xs font-semibold tabular-nums"
          aria-live="polite"
          aria-label={`Jumlah: ${item.quantity}`}
        >
          {item.quantity}
        </span>
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => updateQuantity(Math.min(typeof item.stock === "number" ? item.stock : Number.MAX_SAFE_INTEGER, item.quantity + 1))}
          disabled={removeForm.processing || (typeof item.stock === "number" && item.quantity >= item.stock)}
          aria-label="Tambah jumlah"
        >
          <Icon name="plus" className="size-3" aria-hidden="true" />
        </button>
      </div>
      {updateError ? <span role="alert" className="text-xs text-destructive">{updateError}</span> : null}
    </div>
  )

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-[5px] border border-border bg-white p-3">
      {/* Baris atas: hanya checkbox (mode pilih) */}
      {selectable ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            onClick={onToggle}
            className={cn(
              "flex size-[22px] shrink-0 items-center justify-center rounded-[3px] border transition",
              selected
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-transparent hover:border-primary/60",
            )}
            aria-label={`Pilih ${item.name}`}
          >
            <Icon name="check" className="size-3.5" aria-hidden="true" strokeWidth={3} />
          </button>
        ) : null}

      {/* Baris utama: gambar + teks (gambar & nama sejajar di sini) */}
      <div className="flex min-w-0 items-stretch gap-3 sm:gap-4">
        <Link
          href={routeUrl("product.show", { parent_sku: item.parent_sku })}
          className="shrink-0 self-start"
        >
          <ResponsiveImage
            src={item.image}
            alt={item.name}
            wrapperClassName="size-[75px] rounded-[5px] bg-muted"
            className="object-cover p-0"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            href={routeUrl("product.show", { parent_sku: item.parent_sku })}
            className="line-clamp-2 block break-words text-[13px] font-semibold leading-4 text-foreground hover:text-primary"
          >
            {productName(item.name, item.short_name)}
          </Link>

          <p className="mt-0.5 min-w-0 truncate text-xs text-muted-foreground">
            {[item.variation_1_option, item.variation_2_option].filter(Boolean).join(" - ")}
          </p>

          {/* Harga paling atas, tepat di bawah pilihan variasi */}
          <div className="mt-1 shrink-0">{priceBlock}</div>
        </div>
      </div>

      {/* Baris bawah: input catatan produk rata kiri · qty + X grouped rata kanan */}
      <div className="flex shrink-0 items-center gap-3 border-t border-border pt-3">
        <label className="min-w-0 flex-1 text-left">
          <span className="sr-only">Catatan untuk produk ini</span>
          <input
            id={`cart-note-${item.line_id}`}
            type="text"
            className="w-full rounded-[5px] border border-border bg-surface-muted/50 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
            value={note}
            onChange={(event) => updateNote(event.target.value)}
            placeholder="Catatan untuk produk ini (opsional)"
            maxLength={2000}
            aria-label={`Catatan untuk ${item.name}`}
          />
          {noteSaving ? (
            <span className="mt-0.5 block text-[10px] text-muted-foreground">Menyimpan…</span>
          ) : noteError ? (
            <span role="alert" className="mt-0.5 block text-[10px] font-medium text-destructive">
              {noteError}
            </span>
          ) : null}
        </label>
        <div className="flex shrink-0 items-center gap-2.5">
          {quantityControls}
          <button
            type="button"
            className="flex size-7 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground transition hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => removeForm.post(routeUrl("cart.remove"), { preserveScroll: true })}
            disabled={removeForm.processing}
            aria-label={`Hapus ${item.name}`}
          >
            <Icon name="x" className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}
