import { Link } from "@inertiajs/react"

import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"

const LOGO = {
  light: "/images/brand/light-logo.png",
  dark: "/images/brand/dark-logo.png",
} as const

export function BrandWordmark({
  compact = false,
  variant = "light",
  className,
  href,
}: {
  compact?: boolean
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
        compact ? "min-h-9" : "min-h-10",
        className,
      )}
      aria-label="Ragil Aluminium, ke beranda"
      prefetch={false}
    >
      <img
        src={LOGO[variant]}
        alt="Ragil Aluminium"
        width={compact ? 185 : 200}
        height={compact ? 48 : 52}
        className={cn(
          "w-auto max-w-full object-contain object-left",
          compact ? "h-8 max-w-[7.5rem] sm:h-10 sm:max-w-none" : "h-9 sm:h-10",
        )}
        decoding="async"
      />
    </Link>
  )
}
