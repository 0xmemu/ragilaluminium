import { Link, useForm, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
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


  React.useEffect(() => {
    if (!saving && timer.current === null && latestQuantity.current !== item.quantity) {
      latestQuantity.current = item.quantity
      confirmedQuantity.current = item.quantity
    }
  }, [item.quantity, saving])

  React.useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    quantityAbortRef.current?.abort()
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
      <span className="text-[11px] font-extrabold italic tracking-tight text-sale">Flash Sale</span>
    </span>
  ) : null

  const priceBlock = (
    <div className="text-left">
      {(discountBadge || flashSaleBadge) ? (
        <div className="mb-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {flashSaleBadge}
          {discountBadge}
        </div>
      ) : null}
      {hasDiscount ? (
        <>
          <p className="tabular-nums text-xs leading-4 text-muted-foreground line-through">
            {formatCurrency(lineCompare)}
          </p>
          <p className="tabular-nums text-[13px] font-bold leading-4 text-sale">
            {formatCurrency(lineTotal)}
          </p>
          <p className="mt-0.5 text-xs font-semibold leading-3 text-sale">
            Hemat {formatCurrency(lineDiscount || lineCompare - lineTotal)}
          </p>
        </>
      ) : (
        <p className="tabular-nums text-[13px] font-bold leading-4 text-foreground">
          {formatCurrency(lineTotal)}
        </p>
      )}
    </div>
  )

  const quantityControls = (
    <div className="flex items-center gap-1">
      <QuantityControl
        value={item.quantity}
        onChange={updateQuantity}
        max={typeof item.stock === "number" ? item.stock : undefined}
        disabled={removeForm.processing}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => removeForm.post(routeUrl("cart.remove"), { preserveScroll: true })}
        disabled={removeForm.processing}
        aria-label={`Hapus ${item.name}`}
      >
        <Icon name="x" className="size-3.5" aria-hidden="true" />
      </Button>
      {updateError ? <span role="alert" className="text-xs text-destructive">{updateError}</span> : null}
    </div>
  )

  return (
    <article className="flex min-w-0 items-start gap-3 border-b border-border py-2.5 sm:gap-4 sm:py-3">
      {selectable ? (
        <label className="flex shrink-0 items-center self-center pt-0">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="size-4 cursor-pointer rounded border-border text-primary accent-primary focus:ring-1 focus:ring-primary/50"
            aria-label={`Pilih ${item.name}`}
          />
        </label>
      ) : null}
      <Link
        href={routeUrl("product.show", { parent_sku: item.parent_sku })}
        className="shrink-0 self-start"
      >
        <ResponsiveImage
          src={item.image}
          alt={item.name}
          wrapperClassName="size-[4.5rem] rounded-md bg-muted sm:size-[5rem]"
          className="object-cover p-0"
        />
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={routeUrl("product.show", { parent_sku: item.parent_sku })}
          className="line-clamp-2 block break-words text-xs font-semibold leading-4 text-foreground hover:text-primary sm:text-[13px]"
        >
          {productName(item.name, item.short_name)}
        </Link>

        {/* Variants (left) | Price (right) */}
        <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 sm:gap-x-4">
          <dl className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
            {item.variation_1_option ? (
              <div className="flex min-w-0 gap-1.5">
                <dt className="shrink-0">{item.variation_1_name ?? "Pilihan"}:</dt>
                <dd className="min-w-0 truncate font-semibold text-foreground">{item.variation_1_option}</dd>
              </div>
            ) : null}
            {item.variation_2_option ? (
              <div className="flex min-w-0 gap-1.5">
                <dt className="shrink-0">{item.variation_2_name ?? "Pilihan"}:</dt>
                <dd className="min-w-0 truncate font-semibold text-foreground">{item.variation_2_option}</dd>
              </div>
            ) : null}
          </dl>
          {priceBlock}
        </div>

        {/* Qty controls */}
        <div className="mt-1.5 flex items-center gap-2">
          {quantityControls}
        </div>

      </div>
    </article>
  )
}
