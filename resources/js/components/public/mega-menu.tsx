import { Link } from "@inertiajs/react"
import * as React from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { routeUrl, withQuery } from "@/lib/routes"
import type { MegaMenuColumn } from "@/types"

function itemHref(column: MegaMenuColumn, item: MegaMenuColumn["items"][number]): string {
  if (item.href) return item.href

  const base = routeUrl(column.route)
  return withQuery(base, {
    model: item.model ?? undefined,
    design: item.design ?? undefined,
  })
}

export function MegaMenu({
  columns,
  className,
}: {
  columns: MegaMenuColumn[]
  className?: string
}) {
  const [open, setOpen] = React.useState(false)

  if (!columns.length) return null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative inline-flex min-h-10 items-center gap-1.5 px-3 text-xs font-bold tracking-tight transition hover:text-foreground",
            open ? "text-foreground" : "text-muted-foreground",
            className,
          )}
          aria-expanded={open}
        >
          Produk
          <Icon
            name="caret-down"
            className={cn("h-3.5 w-3.5 transition", open && "rotate-180")}
            aria-hidden="true"
          />
          {open ? (
            <span className="absolute inset-x-3 bottom-0 h-0.5 bg-foreground" aria-hidden="true" />
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-[min(42rem,calc(100vw-2rem))] rounded-none p-3">
        <div className="grid gap-4 sm:grid-cols-2">
          {columns.map((column) => (
            <div key={column.title}>
              <DropdownMenuLabel className="px-2">
                <Link
                  href={routeUrl(column.route)}
                  className="text-foreground hover:underline"
                  onClick={() => setOpen(false)}
                >
                  {column.title}
                </Link>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="grid gap-0.5">
                {column.items.map((item) => (
                  <DropdownMenuItem key={`${column.title}-${item.label}`} asChild>
                    <Link
                      href={itemHref(column, item)}
                      onClick={() => setOpen(false)}
                      className="text-muted-foreground"
                    >
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
