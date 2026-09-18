import * as React from "react"
import { createPortal } from "react-dom"

import { Icon } from "@/components/shared/icon"
import { withCreatableRow, type SearchSelectOption, type SearchSelectRow } from "@/lib/search-select"
import { cn } from "@/lib/utils"

/**
 * SearchSelect - pemilih tunggal bercari untuk admin (pola popover milik
 * sendiri, tanpa dependensi baru; adaptasi wilayah-search-select + navigasi
 * papan tuntas ArrowUp/Down/Enter). Dipakai untuk daftar opsi yang bisa
 * melebihi segenggam, mis. pemilih model produk di form sub model.
 */
/** Bantalan dalam popover: p-1 container + px-2.5 item + ikon status + border. */
const POPOVER_INSET = 52
/** Batas lebar popover supaya tidak menutupi seluruh layar pada opsi panjang. */
const POPOVER_MAX_WIDTH = 420

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
  creatable = false,
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
  /** Boleh memakai nilai baru yang diketik, bukan hanya opsi yang ada. */
  creatable?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const popoverRef = React.useRef<HTMLDivElement>(null)
  // Posisi awal WAJIB sudah fixed dan tersembunyi: kalau dibiarkan kosong ({}),
  // render pertama portal menempel di akhir <body> sebagai elemen alir, jauh di
  // bawah konten. Saat kotak pencarian auto-fokus, browser menggulir halaman ke
  // sana sehingga halaman terlihat melompat turun begitu dropdown dibuka.
  const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
    visibility: "hidden",
    zIndex: 60,
  })

  // Baris tambahan "Pakai <ketikan>" muncul hanya bila creatable dan ketikan
  // belum ada padanannya. Logikanya ada di helper murni supaya bisa diuji
  // Vitest tanpa merender komponen.
  const rows = React.useMemo<SearchSelectRow[]>(
    () => withCreatableRow(options, query, creatable),
    [options, query, creatable],
  )

  // Nilai tersimpan dicocokkan tanpa peduli besar-kecil huruf: server
  // menormalkan kode ke kapital, sedangkan opsi bisa berlabel lain.
  const selectedLabel =
    options.find((option) => option.value === value)?.label ??
    options.find((option) => option.value.toLowerCase() === value.toLowerCase())?.label ??
    (creatable ? value : "")

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
      setQuery("")
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open])

  // Fokus kotak pencarian tanpa menggulir halaman. Fokus biasa memakai
  // scroll-into-view sehingga halaman ikut melompat.
  React.useLayoutEffect(() => {
    if (!open) return
    searchRef.current?.focus({ preventScroll: true })
  }, [open])

  // Opsi disimpan di ref supaya callback posisi tidak perlu ikut dibuat ulang
  // ketika induk mengirim array baru setiap render.
  const optionsRef = React.useRef(options)
  React.useEffect(() => {
    optionsRef.current = options
  }, [options])

  // Popover lewat portal: hindari terpotong ancestor ber-overflow hidden.
  // Lebar popover mengikuti label terpanjang, bukan lebar trigger: tanpa ini
  // label panjang membungkus sampai beberapa baris sehingga daftar sulit dibaca.
  // Trigger sengaja tidak ikut melebar karena opsi SearchSelect bisa ratusan.
  const positionPopover = React.useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const preferUp = spaceBelow < 260 && rect.top > spaceBelow

    // Font diambil dari elemen nyata, lalu lebar diukur lewat canvas supaya
    // daftar ratusan opsi tidak menambah elemen pengukur ke DOM.
    const sample = popoverRef.current?.querySelector<HTMLElement>('[role="option"] span')
      ?? popoverRef.current?.querySelector<HTMLElement>('[role="option"]')
      ?? trigger
    const context = document.createElement("canvas").getContext("2d")
    let contentWidth = 0
    if (context) {
      const style = window.getComputedStyle(sample)
      context.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily]
        .filter(Boolean)
        .join(" ")
      contentWidth = optionsRef.current.reduce(
        (max, option) => Math.max(max, context.measureText(option.label).width),
        0,
      )
    }

    const wanted = contentWidth > 0
      ? Math.min(Math.ceil(contentWidth) + POPOVER_INSET, POPOVER_MAX_WIDTH)
      : 0
    const width = Math.max(Math.round(rect.width), wanted)
    // Popover bisa lebih lebar dari trigger, jadi tepinya dijaga di viewport.
    const left = Math.max(
      8,
      Math.min(Math.round(rect.left), window.innerWidth - width - 8),
    )

    setPopoverStyle({
      position: "fixed",
      left,
      width,
      top: preferUp ? undefined : Math.round(rect.bottom + 4),
      bottom: preferUp ? Math.round(window.innerHeight - rect.top + 4) : undefined,
      visibility: "visible",
      zIndex: 60,
    })
  }, [])

  // useLayoutEffect: posisi dihitung sebelum browser menggambar, jadi tidak ada
  // satu frame pun saat portal masih berada di posisi alir.
  React.useLayoutEffect(() => {
    if (!open) return
    positionPopover()
    window.addEventListener("scroll", positionPopover, true)
    window.addEventListener("resize", positionPopover)
    return () => {
      window.removeEventListener("scroll", positionPopover, true)
      window.removeEventListener("resize", positionPopover)
    }
  }, [open, positionPopover])



  function commit(option: SearchSelectRow) {
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
      setActiveIndex((current) => Math.min(rows.length - 1, current + 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((current) => Math.max(0, current - 1))
    } else if (event.key === "Enter") {
      event.preventDefault()
      const option = rows[activeIndex]
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
        ref={triggerRef}
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

      {open ? createPortal(
        <div
          ref={popoverRef}
          role="listbox"
          aria-label={placeholder}
          style={popoverStyle}
          className="overflow-hidden rounded-md border border-border bg-surface shadow-xl"
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
            {rows.length === 0 ? (
              <p className="p-2.5 text-center text-xs text-muted-foreground">{emptyMessage}</p>
            ) : (
              rows.map((option, index) => {
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
                    <span className="min-w-0 break-words leading-4">
                      {option.custom ? (
                        <>
                          Pakai <span className="font-semibold">{option.label}</span>
                        </>
                      ) : (
                        option.label
                      )}
                    </span>
                    {option.custom ? (
                      <Icon name="plus" className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    ) : isSelected ? (
                      <Icon name="check" className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    ) : null}
                  </button>
                )
              })
            )}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
