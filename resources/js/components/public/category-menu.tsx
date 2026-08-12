import { Link } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

const CATEGORY_LINKS = [
  { label: "Semua Produk", href: "/products/all" },
  { label: "Jendela", href: "/products/windows" },
  { label: "Pintu", href: "/products/doors" },
  { label: "Boven", href: "/products/bouven" },
] as const

/**
 * Menu kategori horizontal homepage — gaya "segment tab" ala Zalora:
 * pill abu muda tanpa border, pill aktif hitam + teks putih (cursor-default),
 * scroll horizontal tanpa scrollbar, rata tengah di layar besar. Pill = model
 * produk saja (Boven Jungkit, Jendela Swing, …); desain (Ornamen/Polos) tidak
 * dibuat link terpisah karena masuk dalam satu model.
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
    "mr-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

  return (
    <section id="menu-kategori" className="scroll-mt-20 border-b border-border bg-background">
      <div className="container-page !px-5 md:!px-8 lg:!px-12 relative py-3">
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Kategori lain"
                className={cn(
                  pillBase,
                  "cursor-pointer bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                Kategori
                <Icon name="chevron-down" className="size-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={10} className="w-56 p-2">
              <DropdownMenuLabel>Kategori</DropdownMenuLabel>
              {CATEGORY_LINKS.map((cat) => (
                <DropdownMenuItem key={cat.href} asChild className="min-h-10 rounded-lg px-3 text-sm">
                  <Link href={cat.href}>{cat.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Model</DropdownMenuLabel>
              {items.map((item) => (
                <DropdownMenuItem key={item.key} asChild className="min-h-10 rounded-lg px-3 text-sm">
                  <Link href={item.href}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
