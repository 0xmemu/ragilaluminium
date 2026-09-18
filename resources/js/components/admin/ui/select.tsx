import * as React from "react"
import { createPortal } from "react-dom"

import { Icon } from "@/components/shared/icon"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/admin/ui/command"
import { cn } from "@/lib/utils"

/**
 * Admin select - combobox dengan searchbar.
 *
 * API tetap seperti native select (value, onChange(event.target.value), anak
 * <option>) supaya seluruh halaman yang memakainya tidak perlu diubah.
 * Dropdown menampilkan kotak pencarian bila jumlah opsi melebihi
 * SEARCH_THRESHOLD; di bawah itu tampil sebagai daftar biasa karena
 * pencarian tidak berguna untuk opsi yang sedikit.
 */

interface OptionItem {
  value: string
  label: string
  disabled: boolean
}

const SEARCH_THRESHOLD = 7

function collectOptions(children: React.ReactNode): OptionItem[] {
  const options: OptionItem[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type !== "option") return
    const value = child.props.value
    const label =
      typeof child.props.children === "string" || typeof child.props.children === "number"
        ? String(child.props.children)
        : String(value)
    options.push({
      value: value === undefined || value === null ? "" : String(value),
      label,
      disabled: Boolean(child.props.disabled),
    })
  })
  return options
}

const Select = React.forwardRef<HTMLButtonElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, value, onChange, name, id, disabled, ...props }, ref) => {
    const [open, setOpen] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)
    const triggerRef = React.useRef<HTMLButtonElement | null>(null)
    const popoverRef = React.useRef<HTMLDivElement>(null)
    // Posisi awal WAJIB sudah fixed dan tersembunyi. Kalau dibiarkan kosong
    // ({}), render pertama portal menempel di akhir <body> sebagai elemen alir
    // normal, jauh di bawah seluruh konten (mis. y=2657 pada halaman pesanan).
    // Saat kotak pencarian menerima fokus, browser menggulir halaman ke sana
    // sehingga halaman terlihat melompat turun begitu dropdown dibuka.
    const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>({
      position: "fixed",
      top: 0,
      left: 0,
      visibility: "hidden",
      zIndex: 60,
    })
    const options = collectOptions(children)
    const showSearch = options.length > SEARCH_THRESHOLD

    const selected = options.find((option) => option.value === String(value ?? ""))
    const selectedLabel = selected?.label ?? options.find((option) => option.value === "")?.label ?? "Pilih..."

    // Daftar opsi dirender lewat portal supaya TIDAK terpotong oleh ancestor
    // ber-overflow hidden (mis. <section class="overflow-hidden"> di form
    // produk). Sebelumnya dropdown terpotong dan sebagian opsi tidak terlihat.
    const positionPopover = React.useCallback(() => {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const preferUp = spaceBelow < 280 && rect.top > spaceBelow
      setPopoverStyle({
        position: "fixed",
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        top: preferUp ? undefined : Math.round(rect.bottom + 4),
        bottom: preferUp ? Math.round(window.innerHeight - rect.top + 4) : undefined,
        visibility: "visible",
        zIndex: 60,
      })
    }, [])

    // useLayoutEffect: posisi dihitung sebelum browser menggambar, jadi tidak
    // ada satu frame pun saat portal masih berada pada posisi alir.
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

    // Fokus kotak pencarian tanpa menggulir halaman. autoFocus bawaan browser
    // memakai scroll-into-view, sehingga halaman ikut melompat.
    React.useLayoutEffect(() => {
      if (!open || !showSearch) return
      const input = popoverRef.current?.querySelector<HTMLInputElement>("[cmdk-input]")
      input?.focus({ preventScroll: true })
    }, [open, showSearch])

    // Tutup saat klik di luar container ATAU di luar popover (portal).
    React.useEffect(() => {
      if (!open) return
      function handlePointerDown(event: PointerEvent) {
        const target = event.target as Node
        if (containerRef.current?.contains(target)) return
        if (popoverRef.current?.contains(target)) return
        setOpen(false)
      }
      document.addEventListener("pointerdown", handlePointerDown)
      return () => document.removeEventListener("pointerdown", handlePointerDown)
    }, [open])

    function selectOption(option: OptionItem) {
      if (option.disabled) return
      setOpen(false)
      if (String(option.value) === String(value ?? "")) return
      // Event sintetis: seluruh pemanggil hanya membaca event.target.value.
      onChange?.({
        target: { value: option.value, name, id },
      } as unknown as React.ChangeEvent<HTMLSelectElement>)
    }

    return (
      <div ref={containerRef} className={cn("relative inline-flex w-full min-w-0 items-center", className)}>
        <button
          ref={(node) => {
            triggerRef.current = node
            if (typeof ref === "function") ref(node)
            else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
          }}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={props["aria-label"]}
          aria-invalid={props["aria-invalid"]}
          disabled={disabled}
          id={id}
          data-name={name}
          onClick={() => !disabled && setOpen((prev) => !prev)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter") {
              if (!open) {
                event.preventDefault()
                setOpen(true)
              }
            }
          }}
          className={cn(
            "flex h-9 min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-surface py-2 pl-3 pr-8 text-left text-sm text-foreground transition duration-150 ease-standard hover:border-foreground/20 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70",
            className,
          )}
        >
          <span className={cn("min-w-0 truncate", !selected && !options.some((option) => option.value === "") && "text-muted-foreground")}>
            {selectedLabel}
          </span>
        </button>
        <Icon
          name="caret-down"
          className={cn(
            "pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          weight="bold"
          aria-hidden="true"
        />

        {open ? createPortal(
          <div ref={popoverRef} style={popoverStyle}
            onKeyDown={(event) => {
              // Cegah Enter meneruskan submit form induk; cmdk tetap memilih item.
              if (event.key === "Enter") event.preventDefault()
            }}
          >
            <Command className="overflow-hidden rounded-md border border-border bg-popover shadow-soft">
              {showSearch ? (
                <CommandInput placeholder="Cari..." />
              ) : null}
              <CommandList className="max-h-72">
                <CommandEmpty>Tidak ada yang cocok</CommandEmpty>
                {options.map((option) => {
                  const isSelected = option.value === String(value ?? "")
                  return (
                    <CommandItem
                      key={option.value || "__empty__"}
                      disabled={option.disabled}
                      value={option.label}
                      onSelect={() => selectOption(option)}
                      className={cn(
                        "cursor-pointer",
                        isSelected && "bg-primary/10 font-semibold text-primary",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {isSelected ? <Icon name="check" className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                    </CommandItem>
                  )
                })}
              </CommandList>
            </Command>
          </div>,
          document.body,
        ) : null}
      </div>
    )
  },
)
Select.displayName = "Select"

export { Select }
