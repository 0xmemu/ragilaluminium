import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

export interface WilayahOption {
  id: string
  name: string
}

interface WilayahSearchSelectProps {
  id: string
  label: string
  options: WilayahOption[]
  valueId: string
  valueName: string
  disabled?: boolean
  loading?: boolean
  error?: string
  placeholder?: string
  searchPlaceholder?: string
  onSelect: (option: WilayahOption | null) => void
}

export function WilayahSearchSelect({
  id,
  label,
  options,
  valueId,
  valueName,
  disabled = false,
  loading = false,
  error,
  placeholder = "Pilih…",
  searchPlaceholder = "Cari…",
  onSelect,
}: WilayahSearchSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((option) => option.name.toLowerCase().includes(needle))
  }, [options, query])

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  React.useEffect(() => {
    if (open) {
      searchRef.current?.focus()
    }
  }, [open])

  React.useEffect(() => {
    if (disabled) {
      // Disabled controls cannot remain open or retain a stale search query.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false)
      setQuery("")
    }
  }, [disabled])

  const displayText = loading ? "Memuat…" : valueName || placeholder
  const showPlaceholder = !loading && !valueName

  return (
    <div ref={rootRef} className="relative space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-muted-foreground">
        {label}
        <span className="text-destructive" aria-hidden="true">
          {" "}
          *
        </span>
      </label>

      <button
        id={id}
        type="button"
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-3 rounded-full border border-input bg-surface px-4 py-2.5 text-left text-base shadow-sm transition duration-200 ease-standard md:text-sm",
          "focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70",
          error && "border-destructive focus:border-destructive focus:ring-destructive/15",
          open && "border-primary ring-4 ring-primary/10",
        )}
        onClick={() => {
          if (disabled || loading) return
          setOpen((current) => !current)
        }}
      >
        <span
          className={cn(
            "min-w-0 truncate",
            showPlaceholder ? "text-muted-foreground" : "font-medium text-foreground",
          )}
        >
          {displayText}
        </span>
        <Icon
          name="caret-down"
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          weight="bold"
          aria-hidden
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
          <div className="border-b border-border p-2">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              autoComplete="off"
              className="min-h-10 w-full rounded-full border border-input bg-surface px-3.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10 md:text-sm"
              aria-label={`Cari ${label}`}
            />
          </div>
          <ul
            role="listbox"
            aria-labelledby={id}
            className="max-h-56 overflow-y-auto py-1"
          >
            {filtered.length ? (
              filtered.map((option) => {
                const selected = option.id === valueId
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={cn(
                        "flex w-full px-4 py-2.5 text-left text-sm transition hover:bg-accent",
                        selected && "bg-primary/5 font-semibold text-primary",
                      )}
                      onClick={() => {
                        onSelect(option)
                        setOpen(false)
                        setQuery("")
                      }}
                    >
                      {option.name}
                    </button>
                  </li>
                )
              })
            ) : (
              <li className="px-4 py-3 text-sm text-muted-foreground">
                Tidak ada hasil untuk pencarian ini.
              </li>
            )}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  )
}
