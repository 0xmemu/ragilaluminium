import { router } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useRotatingPlaceholder } from "@/hooks/use-rotating-placeholder"
import { routeUrl } from "@/lib/routes"

export function SearchDialog({ triggerClassName }: { triggerClassName?: string }) {
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const placeholder = useRotatingPlaceholder(Boolean(query.trim()) || focused || !open)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = query.trim()
    if (value.length < 2) return

    setOpen(false)
    router.get(routeUrl("catalog.index"), { q: value })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            triggerClassName ??
            "inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted active:bg-border"
          }
          aria-label="Cari produk"
        >
          <Icon name="search" className="size-6" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <div>
          <DialogTitle>Cari produk</DialogTitle>
          <DialogDescription className="mt-2">
            Masukkan nama, model, atau ukuran. Minimal dua karakter.
          </DialogDescription>
        </div>
        <form onSubmit={submit} className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            className="min-h-14 rounded-full pl-12 pr-24 text-base"
            aria-label="Kata pencarian"
          />
          <button
            type="submit"
            disabled={query.trim().length < 2}
            className="absolute right-1.5 top-1.5 min-h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-45"
          >
            Cari
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
