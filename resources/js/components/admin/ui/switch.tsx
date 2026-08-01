import { cn } from "@/lib/utils"

/**
 * Admin switch — track rounded-full; aktif = aksen teal (primary), knob putih.
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
        "relative inline-flex h-[1.375rem] w-10 shrink-0 rounded-full border transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        checked ? "border-primary bg-primary" : "border-input bg-muted",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-0.5 top-1/2 size-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-150 motion-reduce:transition-none",
          checked ? "translate-x-[1.125rem]" : "translate-x-0",
        )}
      />
    </button>
  )
}
