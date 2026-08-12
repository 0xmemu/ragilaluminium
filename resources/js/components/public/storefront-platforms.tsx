import { cn } from "@/lib/utils"
import type { SocialLink } from "@/types"

function isLiveHref(href?: string | null): boolean {
  return Boolean(href && href !== "#")
}

function channelOf(item: SocialLink): "marketplace" | "social" {
  if (item.channel === "marketplace" || item.channel === "social") {
    return item.channel
  }
  return ["shopee", "tokopedia", "lazada", "tiktok_shop"].includes(item.key)
    ? "marketplace"
    : "social"
}

/** Platform link: icon (+ optional label). Footer uses icons-only. */
function PlatformChip({
  item,
  dark,
  iconsOnly = false,
}: {
  item: SocialLink
  dark: boolean
  iconsOnly?: boolean
}) {
  const live = isLiveHref(item.href)

  const shell = cn(
    "group inline-flex items-center justify-center transition",
    iconsOnly
      ? cn(
          "size-10 rounded-full",
          dark ? "hover:bg-white/10" : "hover:bg-muted",
        )
      : cn(
          "gap-2 rounded-full px-2 py-1.5",
          dark ? "hover:bg-white/10" : "hover:bg-muted",
        ),
    !live && "cursor-default",
  )

  const content = (
    <>
      {item.icon ? (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden",
            iconsOnly ? "size-7" : "size-8",
          )}
        >
          <img src={item.icon} alt="" className="size-full object-contain" width={28} height={28} />
        </span>
      ) : null}
      {!iconsOnly ? (
        <span
          className={cn(
            "text-xs font-semibold tracking-tight",
            dark ? "text-white" : "text-foreground",
          )}
        >
          {item.label}
        </span>
      ) : null}
    </>
  )

  if (live) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        aria-label={item.label}
        className={shell}
      >
        {content}
      </a>
    )
  }

  return (
    <span className={shell} title={item.label} role="img" aria-label={item.label}>
      {content}
    </span>
  )
}

export function StorefrontPlatforms({
  platforms,
  title = "Ikuti Kami",
  className,
  variant = "light",
  layout = "grouped",
  compact = false,
  align = "start",
  iconsOnly = false,
}: {
  platforms: SocialLink[]
  title?: string
  className?: string
  variant?: "light" | "dark"
  /** grouped = Marketplace + Media Sosial terpisah; inline = deretan ringkas */
  layout?: "grouped" | "inline"
  /** Footer: judul lebih kecil */
  compact?: boolean
  align?: "start" | "center"
  /** Footer: hanya logo, tanpa nama platform */
  iconsOnly?: boolean
}) {
  if (!platforms.length) return null

  const dark = variant === "dark"
  const centered = align === "center"
  const marketplaces = platforms.filter((item) => channelOf(item) === "marketplace")
  const socials = platforms.filter((item) => channelOf(item) === "social")

  if (layout === "inline") {
    return (
      <div className={cn(className, centered && "text-center")}>
        {title ? (
          <p
            className={cn(
              "text-sm font-bold tracking-tight",
              dark ? "text-white" : "text-muted-foreground",
            )}
          >
            {title}
          </p>
        ) : null}
        <ul
          className={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-2",
            title && "mt-3",
            centered && "justify-center",
          )}
        >
          {platforms.map((item) => (
            <li key={item.key}>
              <PlatformChip item={item} dark={dark} iconsOnly={iconsOnly} />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className, centered && "text-center")}>
      {title ? (
        <h2
          className={cn(
            compact ? "text-sm font-bold" : "text-lg font-semibold",
            "tracking-tight",
            dark ? "text-white" : "text-foreground",
          )}
        >
          {title}
        </h2>
      ) : null}

      {marketplaces.length ? (
        <div>
          <p
            className={cn(
              "text-xs font-semibold tracking-tight",
              dark ? "text-white/80" : "text-muted-foreground",
            )}
          >
            Marketplace
          </p>
          <ul className={cn("mt-3 flex flex-wrap gap-1 sm:gap-1.5", centered && "justify-center")}>
            {marketplaces.map((item) => (
              <li key={item.key}>
                <PlatformChip item={item} dark={dark} iconsOnly={iconsOnly} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {socials.length ? (
        <div>
          <p
            className={cn(
              "text-xs font-semibold tracking-tight",
              dark ? "text-white/80" : "text-muted-foreground",
            )}
          >
            Media Sosial
          </p>
          <ul className={cn("mt-3 flex flex-wrap gap-1 sm:gap-1.5", centered && "justify-center")}>
            {socials.map((item) => (
              <li key={item.key}>
                <PlatformChip item={item} dark={dark} iconsOnly={iconsOnly} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
