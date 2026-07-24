import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

export function QuantityControl({
  value,
  onChange,
  min = 1,
  max,
  disabled,
  label = "Jumlah",
  className,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
  label?: string
  className?: string
}) {
  const decreaseDisabled = disabled || value <= min
  const increaseDisabled = disabled || (max !== undefined && value >= max)

  return (
    <div
      className={cn(
        "inline-flex h-11 items-center overflow-hidden rounded-full border border-input bg-surface",
        className,
      )}
    >
      <button
        type="button"
        className="inline-flex h-full w-11 shrink-0 items-center justify-center text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={decreaseDisabled}
        aria-label={`Kurangi ${label.toLowerCase()}`}
      >
        <Icon name="minus" className="h-4 w-4" aria-hidden="true" />
      </button>
      <span
        className="tabular-nums flex h-full min-w-11 items-center justify-center border-x border-input px-3 text-center text-sm font-semibold"
        aria-live="polite"
        aria-label={`${label}: ${value}`}
      >
        {value}
      </span>
      <button
        type="button"
        className="inline-flex h-full w-11 shrink-0 items-center justify-center text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35"
        onClick={() => onChange(max === undefined ? value + 1 : Math.min(max, value + 1))}
        disabled={increaseDisabled}
        aria-label={`Tambah ${label.toLowerCase()}`}
      >
        <Icon name="plus" className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
