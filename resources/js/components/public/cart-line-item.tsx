import { Link, useForm } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { QuantityControl } from "@/components/ui/quantity-control"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { formatCurrency } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { CartItem } from "@/types"

function money(value: number | string | null | undefined): number {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

export function CartLineItem({ item }: { item: CartItem }) {
  const updateForm = useForm({ line_id: item.line_id, quantity: item.quantity })
  const removeForm = useForm({ line_id: item.line_id })

  const unitPrice = money(item.unit_price)
  const comparePrice = item.compare_price == null ? null : money(item.compare_price)
  const lineTotal = money(item.line_total)
  const lineDiscount = money(item.line_discount)
  const hasDiscount =
    lineDiscount > 0 || (comparePrice !== null && comparePrice > unitPrice)
  const unitDiscount =
    comparePrice !== null && comparePrice > unitPrice ? comparePrice - unitPrice : 0
  const lineCompare =
    item.line_compare_total != null
      ? money(item.line_compare_total)
      : hasDiscount && comparePrice !== null
        ? comparePrice * item.quantity
        : lineTotal
  const discountPercent =
    item.discount_percent ??
    (comparePrice && comparePrice > 0 && unitDiscount > 0
      ? Math.round((unitDiscount / comparePrice) * 100)
      : null)

  function updateQuantity(quantity: number) {
    updateForm.setData("quantity", quantity)
    updateForm.transform((data) => ({ ...data, quantity }))
    updateForm.post(routeUrl("cart.update"), { preserveScroll: true })
  }

  const lineTotalBlock = (
    <div className="text-right">
      {hasDiscount ? (
        <>
          <p className="tabular-nums text-xs text-muted-foreground line-through">
            {formatCurrency(lineCompare)}
          </p>
          <p className="tabular-nums text-base font-bold text-sale">{formatCurrency(lineTotal)}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-sale">
            Hemat {formatCurrency(lineDiscount || lineCompare - lineTotal)}
          </p>
        </>
      ) : (
        <p className="tabular-nums text-base font-bold text-foreground">
          {formatCurrency(lineTotal)}
        </p>
      )}
    </div>
  )

  const quantityControls = (
    <>
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
        <Icon name="x" className="h-4 w-4" aria-hidden="true" />
      </Button>
    </>
  )

  return (
    <article className="flex items-start gap-2.5 border-b border-border py-3 sm:gap-4 sm:py-4">
      <Link
        href={routeUrl("product.show", { parent_sku: item.parent_sku })}
        className="shrink-0 self-start"
      >
        <ResponsiveImage
          src={item.image}
          alt={item.name}
          wrapperClassName="size-[5.5rem] rounded-none bg-muted sm:size-[8.5rem]"
          className="object-cover p-0"
        />
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={routeUrl("product.show", { parent_sku: item.parent_sku })}
          className="line-clamp-2 text-sm font-semibold leading-5 text-foreground hover:text-primary"
        >
          {item.name}
        </Link>
        <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
          {item.variation_1_option ? (
            <div className="flex gap-2">
              <dt>{item.variation_1_name ?? "Pilihan"}:</dt>
              <dd className="font-semibold text-foreground">{item.variation_1_option}</dd>
            </div>
          ) : null}
          {item.variation_2_option ? (
            <div className="flex gap-2">
              <dt>{item.variation_2_name ?? "Pilihan"}:</dt>
              <dd className="font-semibold text-foreground">{item.variation_2_option}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-3 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={
                hasDiscount
                  ? "tabular-nums text-base font-bold text-sale"
                  : "tabular-nums text-sm font-semibold text-foreground"
              }
            >
              {formatCurrency(unitPrice)}
            </span>
            {hasDiscount && comparePrice !== null ? (
              <>
                <span className="tabular-nums text-sm font-light text-muted-foreground line-through">
                  {formatCurrency(comparePrice)}
                </span>
                {discountPercent ? (
                  <span className="rounded bg-[#fdf2f2] px-1.5 text-xs font-semibold leading-5 text-[#c81e1e]">
                    −{discountPercent}%
                  </span>
                ) : null}
                {item.flash_sale ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Icon
                      name="lightning"
                      weight="fill"
                      className="size-3.5 shrink-0 text-sale"
                      aria-hidden
                    />
                    <span className="text-xs font-extrabold italic tracking-tight text-sale">
                      FLASH SALE
                    </span>
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
          {hasDiscount ? (
            <p className="text-xs font-semibold text-sale">
              Potongan {formatCurrency(unitDiscount || lineDiscount / Math.max(1, item.quantity))}
              <span className="font-normal text-muted-foreground"> / item</span>
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 sm:hidden">
          {lineTotalBlock}
          <div className="flex items-center gap-2">{quantityControls}</div>
        </div>
      </div>

      <div className="hidden min-h-[7.5rem] shrink-0 flex-col items-end self-stretch sm:flex sm:min-h-[8.5rem]">
        {lineTotalBlock}
        <div className="mt-auto flex items-center gap-2 pt-3">{quantityControls}</div>
      </div>
    </article>
  )
}
