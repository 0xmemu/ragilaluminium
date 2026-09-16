import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { filterSearchOptions, type SearchSelectOption } from "@/lib/search-select"
import { cn } from "@/lib/utils"

/**
 * SearchSelect - pemilih tunggal bercari untuk admin (pola popover milik
 * sendiri, tanpa dependensi baru; adaptasi wilayah-search-select + navigasi
 * papan tuntas ArrowUp/Down/Enter). Dipakai untuk daftar opsi yang bisa
 * melebihi segenggam, mis. pemilih model produk di form sub model.
 */
export function SearchSelect({
  id,
  options,
  value,
  onValueChange,
  placeholder = "Pilih",
  searchPlaceholder = "Cari",
  emptyMessage = "Tidak ditemukan.",
  disabled = false,
  error,
  className,
}: {
  id: string
  options: SearchSelectOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  error?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)

  const filtered = React.useMemo(
    () => filterSearchOptions(options, query),
    [options, query],
  )

  const selectedLabel = options.find((option) => option.value === value)?.label ?? ""

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open])

  React.useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])



  function commit(option: SearchSelectOption) {
    onValueChange(option.value)
    setOpen(false)
    setQuery("")
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter") {
        event.preventDefault()
        setOpen(true)
      }
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((current) => Math.min(filtered.length - 1, current + 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((current) => Math.max(0, current - 1))
    } else if (event.key === "Enter") {
      event.preventDefault()
      const option = filtered[activeIndex]
      if (option) commit(option)
    } else if (event.key === "Escape") {
      setOpen(false)
      setQuery("")
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-surface px-3 py-1.5 text-left text-xs transition duration-150 ease-standard",
          "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70",
          error && "border-destructive focus:border-destructive focus:ring-destructive/15",
          open && "border-primary ring-2 ring-primary/15",
        )}
        onClick={() => {
          if (disabled) return
          setOpen((current) => !current)
          setActiveIndex(0)
        }}
        onKeyDown={handleKeyDown}
      >
        <span
          className={cn(
            "min-w-0 truncate",
            selectedLabel ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {selectedLabel || placeholder}
        </span>
        <Icon
          name="caret-down"
          className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {error ? (
        <p className="mt-1 text-xs font-medium text-destructive" role="alert">{error}</p>
      ) : null}

      {open ? (
        <div
          role="listbox"
          aria-label={placeholder}
          className="absolute left-0 top-full z-50 mt-1 w-full min-w-48 overflow-hidden rounded-md border border-border bg-surface shadow-xl"
        >
          <div className="border-b border-border bg-surface p-1.5">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded border border-input bg-surface px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div className="max-h-60 divide-y divide-border/20 overflow-y-auto bg-surface p-1 text-xs">
            {filtered.length === 0 ? (
              <p className="p-2.5 text-center text-xs text-muted-foreground">{emptyMessage}</p>
            ) : (
              filtered.map((option, index) => {
                const isSelected = option.value === value
                const isActive = index === activeIndex
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "flex w-full items-center justify-between rounded px-2.5 py-2 text-left text-xs transition",
                      isSelected
                        ? "bg-primary/10 font-semibold text-primary"
                        : "text-foreground hover:bg-surface-muted",
                      isActive && !isSelected && "bg-surface-muted",
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(option)}
                  >
                    <span className="min-w-0 break-words leading-4">{option.label}</span>
                    {isSelected ? (
                      <Icon name="check" className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    ) : null}
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
