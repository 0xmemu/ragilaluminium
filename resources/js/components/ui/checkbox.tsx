import * as React from "react"

import { cn } from "@/lib/utils"

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string
  /** Checklist bulat (bukan kotak). */
  round?: boolean
  /** Ukuran lebih kecil (tinggi & gap dikurangi). */
  compact?: boolean
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, round = false, compact = false, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId

    if (round) {
      return (
        <label
          htmlFor={inputId}
          className={cn(
            "inline-flex cursor-pointer items-center",
            compact ? "min-h-0 gap-2 text-xs" : "min-h-11 gap-3 text-sm",
          )}
        >
          <span className="relative inline-flex shrink-0">
            <input
              ref={ref}
              id={inputId}
              type="checkbox"
              className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
              {...props}
            />
            <span
              className={cn(
                "pointer-events-none flex items-center justify-center rounded-full border border-input bg-surface transition peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-checked:border-primary peer-checked:bg-primary peer-checked:[&_svg]:opacity-100 peer-disabled:opacity-50",
                compact ? "size-4" : "size-5",
                className,
              )}
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 16 16"
                className="size-[70%] text-primary-foreground opacity-0 transition"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
              </svg>
            </span>
          </span>
          {label ? (
            <span className={cn("font-medium text-foreground", compact && "leading-4")}>{label}</span>
          ) : null}
        </label>
      )
    }

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "inline-flex cursor-pointer items-center",
          compact ? "min-h-0 gap-2 text-xs" : "min-h-11 gap-3 text-sm",
        )}
      >
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className={cn(
            "shrink-0 rounded border border-input bg-surface text-primary accent-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            compact ? "size-4" : "h-5 w-5",
            className,
          )}
          {...props}
        />
        {label ? (
          <span className={cn("font-medium text-foreground", compact && "leading-4")}>{label}</span>
        ) : null}
      </label>
    )
  },
)
Checkbox.displayName = "Checkbox"
