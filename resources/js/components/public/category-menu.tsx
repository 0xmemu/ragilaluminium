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
 * Menu kategori horizontal homepage — gaya "segment tab" ala Zalora:
 * pill abu muda tanpa border, pill aktif hitam + teks putih (cursor-default),
 * scroll horizontal tanpa scrollbar, rata tengah di layar besar. Pill = model
 * produk saja (Boven Jungkit, Jendela Swing, …); urutan dikelola admin di
 * dashboard (tanpa dropdown "Kategori lain").
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

  const pillBase =
    "mr-2 whitespace-nowrap rounded-sm px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

  return (
    <section id="menu-kategori" className="scroll-mt-20 border-b border-border bg-background">
      <div className="relative py-2">
        <nav
          ref={scrollRef}
          aria-label="Kategori produk"
          className="scrollbar-none flex flex-row items-center overflow-x-scroll overscroll-x-contain xl:justify-center"
        >
          {items.map((item, index) => {
            const active = item.key === activeKey
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  pillBase,
                  // Zalora: pill pertama diberi inset kiri di mobile, hilang di desktop.
                  index === 0 && "ml-4 xl:ml-0",
                  active
                    ? "cursor-default bg-foreground text-background"
                    : "bg-secondary text-foreground hover:bg-secondary/70",
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Edge fade ala Zalora — hanya mobile/tablet, menandakan konten bisa discroll */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-11 bg-gradient-to-r from-background to-transparent md:hidden"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-11 bg-gradient-to-l from-background to-transparent md:hidden"
          aria-hidden="true"
        />
      </div>
    </section>
  )
}
