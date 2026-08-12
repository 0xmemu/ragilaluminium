import { Link } from "@inertiajs/react"
import * as React from "react"

import { useSwipeClickSuppression } from "@/hooks/use-swipe-click-suppression"
import { cn } from "@/lib/utils"

export interface CategoryMenuSub {
  label: string
  href: string
}

export interface CategoryMenuItem {
  key: string
  label: string
  href: string
  category?: string | null
  model?: string | null
  subs: CategoryMenuSub[]
}

/**
 * Menu kategori horizontal (home + halaman model). Tombol model memakai frame:
 * abu-abu (border-border) saat tidak aktif, hitam (border-foreground +
 * bg-foreground) saat dipilih — konsisten di semua halaman.
 */
export function CategoryMenu({
  items,
  activeKey = null,
}: {
  items: CategoryMenuItem[]
  activeKey?: string | null
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  useSwipeClickSuppression(scrollRef)

  if (!items.length) return null

  return (
    <section id="menu-kategori" className="scroll-mt-20 border-b border-border bg-surface">
      <div className="container-page !px-5 md:!px-8 lg:!px-12">
        <div
          ref={scrollRef}
          className="scrollbar-x -mx-1 flex items-center gap-2 overflow-x-auto px-1 py-3 sm:gap-2.5"
        >
          {items.map((item) => {
            const active = item.key === activeKey
            return (
              <React.Fragment key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg border px-3.5 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    active
                      ? "border-foreground bg-foreground text-background shadow-sm"
                      : "border-border bg-surface text-foreground hover:border-foreground/50 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
                {item.subs.map((sub) => (
                  <Link
                    key={sub.href}
                    href={sub.href}
                    className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap px-2.5 text-[12px] font-medium text-muted-foreground transition hover:underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {sub.label}
                  </Link>
                ))}
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </section>
  )
}
