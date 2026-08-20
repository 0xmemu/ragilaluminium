import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

export interface WilayahOption {
  id: string
  name: string
  postal_code?: string | null
  postcode?: string | null
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
  className?: string
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
  className,
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
      setOpen(false)
      setQuery("")
    }
  }, [disabled])

  const displayText = loading ? "Memuat…" : valueName || placeholder
  const showPlaceholder = !loading && !valueName

  return (
    <div ref={rootRef} className={cn("relative space-y-1", className)}>
      <label htmlFor={id} className="block text-xs font-semibold text-foreground">
        {label}
        <span className="text-primary ml-0.5" aria-hidden="true">
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
          "flex h-9 min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-surface px-3 py-1.5 text-left text-xs shadow-none transition duration-150 ease-standard",
          "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70",
          error && "border-destructive focus:border-destructive focus:ring-destructive/15",
          open && "border-primary ring-2 ring-primary/15",
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
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          weight="bold"
          aria-hidden="true"
        />
      </button>

      {error ? (
        <p className="text-[11px] font-medium leading-4 text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="absolute z-dropdown mt-1 max-h-60 w-full min-w-48 overflow-hidden rounded-md border border-border bg-surface shadow-lg"
        >
          <div className="border-b border-border p-1.5">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded border border-input bg-surface px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>

          <div className="max-h-48 overflow-y-auto p-1 text-xs">
            {filtered.length === 0 ? (
              <p className="p-2 text-center text-xs text-muted-foreground">Tidak ditemukan.</p>
            ) : (
              filtered.map((option) => {
                const isSelected = option.id === valueId
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition",
                      isSelected
                        ? "bg-primary/10 font-semibold text-primary"
                        : "text-foreground hover:bg-surface-muted",
                    )}
                    onClick={() => {
                      onSelect(option)
                      setOpen(false)
                      setQuery("")
                    }}
                  >
                    <span className="truncate">{option.name}</span>
                    {isSelected ? <Icon name="check" className="size-3.5 shrink-0 text-primary" weight="bold" /> : null}
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
