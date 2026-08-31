import { Link } from "@inertiajs/react"
import * as React from "react"

import { MobileStickyCta } from "@/components/public/mobile-sticky-cta"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/format"

/**
 * Satu sumber ringkasan + CTA checkout untuk Cart (fungsi sama di desktop & mobile).
 * variant:
 * - "panel"  : blok dl + tombol di akhir daftar item (desktop lg+, dan ringkasan flat mobile).
 * - "sticky" : isi MobileStickyCta (ringkasan inline + tombol, tampil mobile saja).
 * Perilaku disabled/processing/label satu sumber via props agar tidak pernah divergen.
 */
export function CartCheckoutSummary({
  variant,
  itemCount,
  subtotal,
  discount,
  disabled,
  processing,
  onSubmit,
}: {
  variant: "panel" | "sticky"
  itemCount: number
  subtotal: number
  discount: number
  disabled: boolean
  processing: boolean
  onSubmit: React.FormEventHandler
}) {
  const hasDiscount = discount > 0
  const label = `Checkout (${itemCount})`
  const submitButton = (
    <Button
      type="submit"
      size="md"
      className={
        variant === "panel"
          ? "h-10 min-h-10 min-w-0 px-5 text-sm"
          : "h-10 min-h-10 min-w-0 shrink-0 px-3 text-xs min-[375px]:px-5 min-[375px]:text-sm"
      }
      disabled={disabled || processing}
    >
      {label}
      <Icon name="arrow-right" className="size-4" aria-hidden="true" />
    </Button>
  )

  if (variant === "sticky") {
    return (
      <MobileStickyCta
        aria-label="Lanjut checkout"
        spacerClassName="h-[calc(var(--mobile-sticky-cta-height)+0.5rem)]"
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-medium text-muted-foreground">Subtotal</span>
          <span className="tabular-nums text-sm font-bold leading-5">{formatCurrency(subtotal)}</span>
        </div>
        <form onSubmit={onSubmit}>{submitButton}</form>
      </MobileStickyCta>
    )
  }

  return (
    <div>
      <dl className="space-y-2 text-xs">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">Subtotal ({itemCount} barang)</dt>
          <dd className="tabular-nums font-semibold text-foreground">{formatCurrency(subtotal)}</dd>
        </div>
        {hasDiscount ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Total Potongan</dt>
            <dd className="tabular-nums font-semibold text-sale">
              −{formatCurrency(discount)}
            </dd>
          </div>
        ) : null}
      </dl>
      <form onSubmit={onSubmit} className="mt-3 flex justify-end">
        {submitButton}
      </form>
    </div>
  )
}
