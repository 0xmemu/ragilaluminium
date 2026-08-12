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
 * Menu kategori horizontal (home + halaman model). Pill = model produk saja
 * (Boven Jungkit, Jendela Swing, …); desain (Ornamen/Polos) tidak dibuat link
 * terpisah karena masuk dalam satu model dan tampil bersamaan di halaman model.
 * Gaya pill meniru nav katalog: frame abu-abu saat tidak aktif, hitam saat
 * dipilih. Font 12px, frame padding 12px.
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
      <div className="container-page !px-5 md:!px-8 lg:!px-12 py-[10px]">
        <nav
          ref={scrollRef}
          aria-label="Kategori produk"
          className="scrollbar-x flex items-center gap-2 overflow-x-auto"
        >
          {items.map((item) => {
            const active = item.key === activeKey
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active
                    ? "border-foreground bg-foreground text-background shadow-sm"
                    : "border-border bg-surface text-foreground hover:border-foreground/50",
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
                className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-0.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-muted-foreground transition hover:border-foreground/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
      </div>
    </section>
  )
}
