import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Toggle status on/off. Knob dipasang dengan `left-0.5` supaya posisinya tidak
 * ikut `text-align: center` bawaan <button> (dulu knob keluar dari track).
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  className,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        checked ? "border-success bg-success" : "border-border bg-border",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-0.5 top-0.5 size-5 rounded-full bg-success-foreground shadow-sm transition-transform motion-reduce:transition-none",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  )
}
