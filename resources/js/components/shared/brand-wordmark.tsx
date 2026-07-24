import { Link } from "@inertiajs/react"

import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"

const LOGO = {
  light: "/images/brand/light-logo.png",
  dark: "/images/brand/dark-logo.png",
} as const

const MARK = {
  light: "/images/brand/light-mark.png",
  dark: "/images/brand/dark-mark.png",
} as const

export function BrandWordmark({
  compact = false,
  mark = false,
  variant = "light",
  className,
  href,
}: {
  compact?: boolean
  /** Emblem only — mobile header beside search. */
  mark?: boolean
  /** `light` = for light backgrounds; `dark` = for dark backgrounds */
  variant?: keyof typeof LOGO
  className?: string
  href?: string
}) {
  return (
    <Link
      href={href ?? routeUrl("home")}
      className={cn(
        "group relative z-20 inline-flex items-center",
        mark ? "size-9 shrink-0" : compact ? "min-h-9" : "min-h-10",
        className,
      )}
      aria-label="Ragil Aluminium, ke beranda"
      prefetch={false}
    >
      <img
        src={mark ? MARK[variant] : LOGO[variant]}
        alt="Ragil Aluminium"
        width={mark ? 36 : compact ? 185 : 200}
        height={mark ? 36 : compact ? 48 : 52}
        className={cn(
          "object-contain",
          mark
            ? "size-9"
            : cn(
                "w-auto max-w-full object-left",
                compact ? "h-8 max-w-[7.5rem] sm:h-10 sm:max-w-none" : "h-9 sm:h-10",
              ),
        )}
        decoding="async"
      />
    </Link>
  )
}
