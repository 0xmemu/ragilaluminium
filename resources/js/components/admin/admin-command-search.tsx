import { Link, usePage } from "@inertiajs/react"
import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/admin/ui/dialog"
import { Icon } from "@/components/shared/icon"
import { filterAdminSearchHits, flattenAdminNav, type AdminSearchHit } from "@/lib/admin-search"
import { cn } from "@/lib/utils"
import type { SharedPageProps } from "@/types"

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px] leading-none text-muted-foreground">
      {children}
    </kbd>
  )
}

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
    const id = window.setTimeout(() => inputRef.current?.focus(), 10)
    return () => window.clearTimeout(id)
  }, [open])

  function handleOpenChange(next: boolean) {
    if (next) {
      setQuery("")
      setActiveIndex(0)
    }
    onOpenChange(next)
  }

  function goTo(_hit: AdminSearchHit) {
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideClose
        className="top-[22%] w-[min(calc(100%-2rem),36rem)] -translate-y-0 gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Cari di admin</DialogTitle>
        <DialogDescription className="sr-only">
          Loncat ke menu dashboard. Ketik nama modul, lalu Enter.
        </DialogDescription>

        <label className="flex h-12 items-center gap-3 border-b border-border px-4">
          <Icon
            name="search"
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">Kata kunci pencarian</span>
          <input
            ref={inputRef}
            data-admin-search
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="Cari menu admin…"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70 [&::-webkit-search-cancel-button]:hidden"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <Kbd>esc</Kbd>
        </label>

        <ul
          role="listbox"
          aria-label="Hasil pencarian menu"
          className="max-h-[min(50dvh,20rem)] overflow-y-auto p-1.5"
        >
          {hits.length === 0 ? (
            <li className="px-3 py-10 text-center">
              <p className="text-sm font-medium text-foreground">Tidak ada hasil</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Coba kata kunci lain, misalnya “pesanan” atau “voucher”.
              </p>
            </li>
          ) : (
            hits.map((hit, index) => (
              <li key={hit.id} role="option" aria-selected={index === activeIndex}>
                <Link
                  href={hit.href}
                  data-admin-search-hit={hit.id}
                  onClick={() => goTo(hit)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-md px-2.5 text-sm transition duration-75",
                    index === activeIndex
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground",
                  )}
                >
                  <Icon
                    name={hit.icon ?? "package"}
                    className={cn(
                      "h-4 w-4 shrink-0",
                      index === activeIndex ? "text-accent-foreground" : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{hit.label}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{hit.group}</span>
                </Link>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center gap-3 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            navigasi
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            buka
          </span>
          <span className="ml-auto hidden sm:block">Pencarian menu admin</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
