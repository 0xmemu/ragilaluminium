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
          : "h-10 min-h-10 min-w-0 shrink-0 px-2.5 text-[11px] leading-tight min-[375px]:px-4 min-[375px]:text-xs"
      }
      disabled={disabled || processing}
    >
      <span className="min-w-0 text-left">
        <span className="block truncate">{label}</span>
      </span>
      <Icon name="arrow-right" className="size-4 shrink-0" aria-hidden="true" />
    </Button>
  )

  if (variant === "sticky") {
    return (
      <MobileStickyCta
        aria-label="Lanjut checkout"
        spacerClassName="h-[calc(var(--mobile-sticky-cta-height)+0.5rem)]"
        className="!p-0 !border-t-0 shadow-[0_-4px_16px_hsl(var(--foreground)/0.08)]"
      >
        {/* Continuous segmented bar tanpa pill tombol terpisah - konsisten dgn PDP */}
        <div className="flex w-full items-stretch divide-x divide-border overflow-hidden border-t border-border bg-surface">
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3">
            <span className="text-[10px] font-medium leading-3 text-muted-foreground">Subtotal</span>
            <span className="tabular-nums text-sm font-bold leading-5">{formatCurrency(subtotal)}</span>
            {hasDiscount ? (
              <span className="tabular-nums text-[10px] font-semibold leading-3 text-sale">
                Hemat {formatCurrency(discount)}
              </span>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={disabled || processing}
            className="flex w-[45%] shrink-0 items-center justify-center gap-1.5 bg-primary px-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover active:bg-primary-hover/90 disabled:opacity-40 focus-visible:outline-none"
            aria-label={label}
          >
            <span className="truncate">{label}</span>
            <Icon name="arrow-right" className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
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
            <dt className="text-muted-foreground">Hemat</dt>
            <dd className="tabular-nums font-semibold text-sale">
              {formatCurrency(discount)}
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
