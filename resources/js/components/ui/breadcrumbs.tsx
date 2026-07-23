import { Link } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  href?: string | null
}

export function Breadcrumbs({
  items,
  className,
  tone = "default",
}: {
  items: BreadcrumbItem[]
  className?: string
  /** `onDark` for Graphite / Flash Sale heroes. */
  tone?: "default" | "onDark"
}) {
  if (!items.length) return null

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol
        className={cn(
          "flex flex-wrap items-center gap-2 text-xs font-medium",
          tone === "onDark" ? "text-white/55" : "text-muted-foreground",
        )}
      >
        {items.map((item, index) => {
          const current = index === items.length - 1

          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
              {index > 0 ? (
                <Icon
                  name="chevron-right"
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    tone === "onDark" ? "text-white/35" : undefined,
                  )}
                  aria-hidden="true"
                />
              ) : null}
              {item.href && !current ? (
                <Link
                  href={item.href}
                  className={cn(
                    "transition",
                    tone === "onDark"
                      ? "text-white/70 hover:text-white"
                      : "hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={
                    current
                      ? tone === "onDark"
                        ? "text-white"
                        : "text-foreground"
                      : undefined
                  }
                  aria-current={current ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
