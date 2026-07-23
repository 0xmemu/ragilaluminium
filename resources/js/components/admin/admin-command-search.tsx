import { Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { filterAdminSearchHits, flattenAdminNav, type AdminSearchHit } from "@/lib/admin-search"
import { cn } from "@/lib/utils"
import type { SharedPageProps } from "@/types"

export function AdminCommandSearch({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { nav } = usePage<SharedPageProps>().props
  const [query, setQuery] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const allHits = React.useMemo(() => flattenAdminNav(nav?.admin), [nav?.admin])
  const hits = React.useMemo(() => filterAdminSearchHits(allHits, query), [allHits, query])

  React.useEffect(() => {
    if (!open) return
    setQuery("")
    setActiveIndex(0)
    const id = window.setTimeout(() => inputRef.current?.focus(), 10)
    return () => window.clearTimeout(id)
  }, [open])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query])

  function goTo(hit: AdminSearchHit) {
    onOpenChange(false)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, Math.max(hits.length - 1, 0)))
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === "Enter" && hits[activeIndex]) {
      event.preventDefault()
      const link = document.querySelector<HTMLAnchorElement>(
        `[data-admin-search-hit="${hits[activeIndex].id}"]`,
      )
      link?.click()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:p-0">
        <div className="border-b border-border px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
          <DialogTitle className="text-lg">Cari di admin</DialogTitle>
          <DialogDescription className="mt-1">
            Loncat ke menu dashboard. Ketik nama modul, lalu Enter.
          </DialogDescription>
          <label className="relative mt-4 block">
            <span className="sr-only">Kata kunci pencarian</span>
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              data-admin-search
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Contoh: pesanan, import, voucher…"
              className="h-11 w-full rounded-full border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
        </div>

        <ul
          role="listbox"
          aria-label="Hasil pencarian menu"
          className="max-h-[min(50dvh,22rem)] overflow-y-auto p-2"
        >
          {hits.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              Tidak ada menu yang cocok.
            </li>
          ) : (
            hits.map((hit, index) => (
              <li key={hit.id} role="option" aria-selected={index === activeIndex}>
                <Link
                  href={hit.href}
                  data-admin-search-hit={hit.id}
                  onClick={() => goTo(hit)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                    index === activeIndex
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent",
                  )}
                >
                  <Icon
                    name={hit.icon ?? "package"}
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold">{hit.label}</span>
                  <span
                    className={cn(
                      "shrink-0 text-[11px]",
                      index === activeIndex ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {hit.group}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
