import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Fixed commerce action strip above MobileBottomNav (lg:hidden).
 * Spacer is non-interactive height only (do not clone controls).
 */
export function MobileStickyCta({
  children,
  className,
  spacerClassName,
  "aria-label": ariaLabel = "Aksi cepat",
}: {
  children: ReactNode
  className?: string
  /** Layout spacer height; must cover sticky bar content. */
  spacerClassName?: string
  "aria-label"?: string
}) {
  return (
    <>
      <div
        className={cn("lg:hidden", spacerClassName ?? "h-[calc(var(--mobile-sticky-cta-height)+0.5rem)]")}
        aria-hidden="true"
      />
      <div
        role="region"
        aria-label={ariaLabel}
        className={cn(
          "mobile-sticky-cta border-t border-border bg-surface/95 px-3 py-2.5 shadow-[0_-8px_24px_hsl(var(--foreground)/0.08)] backdrop-blur-md lg:hidden",
          className,
        )}
      >
        <div className="mx-auto flex w-full max-w-lg items-center gap-2">{children}</div>
      </div>
    </>
  )
}
