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
        "inline-flex items-center gap-0.5",
        className,
      )}
    >
      <button
        type="button"
        className="inline-flex size-11 shrink-0 items-center justify-center text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={decreaseDisabled}
        aria-label={`Kurangi ${label.toLowerCase()}`}
      >
        <Icon name="minus" className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span
        className="tabular-nums min-w-[1rem] text-center text-xs font-semibold"
        aria-live="polite"
        aria-label={`${label}: ${value}`}
      >
        {value}
      </span>
      <button
        type="button"
        className="inline-flex size-11 shrink-0 items-center justify-center text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35"
        onClick={() => onChange(max === undefined ? value + 1 : Math.min(max, value + 1))}
        disabled={increaseDisabled}
        aria-label={`Tambah ${label.toLowerCase()}`}
      >
        <Icon name="plus" className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
