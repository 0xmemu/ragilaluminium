import { Link, useForm } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { QuantityControl } from "@/components/ui/quantity-control"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { formatCurrency, productName } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { CartItem } from "@/types"

function money(value: number | string | null | undefined): number {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

export function CartLineItem({ item, selected, onToggle }: { item: CartItem; selected: boolean; onToggle: () => void }) {
  const updateForm = useForm({ line_id: item.line_id, quantity: item.quantity })
  const removeForm = useForm({ line_id: item.line_id })

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
    updateForm.setData("quantity", quantity)
    updateForm.transform((data) => ({ ...data, quantity }))
    updateForm.post(routeUrl("cart.update"), { preserveScroll: true })
  }

  const discountBadge = discountPercent ? (
    <span className="rounded bg-accent px-1 text-[10px] font-semibold leading-4 text-accent-foreground">
      −{discountPercent}%
    </span>
  ) : null

  const flashSaleBadge = item.flash_sale ? (
    <span className="inline-flex items-center gap-0.5">
      <Icon name="lightning" weight="fill" className="size-3 shrink-0 text-sale" aria-hidden />
      <span className="text-[10px] font-extrabold italic tracking-tight text-sale">FLASH SALE</span>
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
          <p className="tabular-nums text-[10px] leading-4 text-muted-foreground line-through">
            {formatCurrency(lineCompare)}
          </p>
          <p className="tabular-nums text-[13px] font-bold leading-4 text-sale">
            {formatCurrency(lineTotal)}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold leading-3 text-sale">
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
        value={updateForm.data.quantity}
        onChange={updateQuantity}
        max={typeof item.stock === "number" ? item.stock : undefined}
        disabled={updateForm.processing || removeForm.processing}
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
    </div>
  )

  return (
    <article className="flex min-w-0 items-start gap-3 border-b border-border py-2.5 sm:gap-4 sm:py-3">
      <label className="flex shrink-0 items-center self-center pt-0">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="size-4 cursor-pointer rounded border-border text-primary accent-primary focus:ring-1 focus:ring-primary/50"
          aria-label={`Pilih ${item.name}`}
        />
      </label>
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
          <dl className="min-w-0 space-y-0.5 text-[10px] text-muted-foreground">
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
