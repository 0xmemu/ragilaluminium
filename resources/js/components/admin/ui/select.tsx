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
 *
 * `popoverFooter` menaruh panel tambahan DI DALAM popover, di bawah daftar
 * opsi. Dipakai filter yang butuh input lanjutan tanpa keluar dari dropdown
 * (mis. rentang tanggal pada daftar pesanan). Panel itu wajib menahan
 * keydown-nya sendiri supaya cmdk tidak menelan tombol panah dan Enter.
 *
 * `keepOpenOnSelect` mencegah popover menutup untuk opsi tertentu, sehingga
 * opsi yang membuka panel lanjutan tidak menutup dropdown sebelum panelnya
 * sempat dipakai.
 */

interface OptionItem {
  value: string
  label: string
  disabled: boolean
}

const SEARCH_THRESHOLD = 7

/** Ruang teks di dalam tombol trigger: pl-3 (12px) + pr-8 (32px). */
const BUTTON_TEXT_INSET = 44

/**
 * Batas lebar kontrol dan popover. Opsi bisa sangat panjang (mis. nama
 * produk lengkap), jadi lebar tidak boleh mengikuti label tanpa batas: kalau
 * dibiarkan, satu dropdown melebarkan seluruh baris dan halaman bergeser
 * horizontal. Di atas batas ini label dipotong dan teks utuhnya tersedia
 * lewat atribut title serta di dalam popover yang lebih lebar.
 */
const MAX_CONTROL_WIDTH = 384
const MAX_POPOVER_WIDTH = 480

/** Bantalan di dalam popover: p-1 container + item + ikon status. */
const POPOVER_TEXT_INSET = 52

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

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /**
   * Aktif secara default: setiap dropdown admin melebar mengikuti label
   * terpanjang supaya lebarnya tidak berubah saat pilihan berganti dan label
   * di popover tidak terpotong. Matikan dengan false hanya untuk kasus yang
   * memang harus persis selebar sel induknya.
   */
  matchOptionWidth?: boolean
  /**
   * Panel tambahan DI DALAM popover, di bawah daftar opsi. Dipakai filter yang
   * butuh input lanjutan tanpa keluar dari dropdown (mis. rentang tanggal).
   */
  popoverFooter?: React.ReactNode
  /**
   * Kembalikan true untuk opsi yang TIDAK boleh menutup popover, mis. opsi
   * yang membuka panel lanjutan di `popoverFooter`.
   */
  keepOpenOnSelect?: (value: string) => boolean
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      className,
      children,
      value,
      onChange,
      name,
      id,
      disabled,
      matchOptionWidth = true,
      popoverFooter,
      keepOpenOnSelect,
      ...props
    },
    ref,
  ) => {
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

    // Lebar teks label diukur lewat elemen tak terlihat dengan font yang sama,
    // lalu dipakai sebagai min-width. min-width dipilih (bukan width) supaya
    // kontrol tetap boleh lebih lebar bila induknya memaksa, namun tidak pernah
    // menyusut di bawah label terpanjang.
    const sizerRef = React.useRef<HTMLDivElement>(null)
    const [longestLabelWidth, setLongestLabelWidth] = React.useState<number | null>(null)
    // Kunci stabil: children baru setiap render, teks label tidak.
    const labelKey = options.map((option) => option.label).join("|")

    React.useLayoutEffect(() => {
      if (!matchOptionWidth) return
      const measure = () => {
        const sizer = sizerRef.current
        if (!sizer) return
        const widest = Array.from(sizer.children).reduce<number>(
          (max, child) => Math.max(max, child.getBoundingClientRect().width),
          0,
        )
        setLongestLabelWidth(widest > 0 ? Math.ceil(widest) : null)
      }

      measure()
      // Web font bisa mengubah metrik teks setelah render pertama, jadi ukur
      // ulang saat font selesai dimuat supaya lebar tidak terkunci terlalu kecil.
      document.fonts?.ready.then(measure).catch(() => {})
    }, [matchOptionWidth, labelKey])

    const minWidthStyle =
      longestLabelWidth !== null
        ? { minWidth: Math.min(longestLabelWidth + BUTTON_TEXT_INSET, MAX_CONTROL_WIDTH) }
        : undefined

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
      const wanted = longestLabelWidth !== null
        ? Math.min(longestLabelWidth + POPOVER_TEXT_INSET, MAX_POPOVER_WIDTH)
        : 0
      const width = Math.max(Math.round(rect.width), wanted)
      setPopoverStyle({
        position: "fixed",
        left: Math.max(8, Math.min(Math.round(rect.left), window.innerWidth - width - 8)),
        width,
        top: preferUp ? undefined : Math.round(rect.bottom + 4),
        bottom: preferUp ? Math.round(window.innerHeight - rect.top + 4) : undefined,
        visibility: "visible",
        zIndex: 60,
      })
    }, [longestLabelWidth])

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
      // Opsi yang membuka panel lanjutan (mis. Rentang tanggal) dibiarkan
      // terbuka supaya panelnya bisa langsung dipakai.
      if (!keepOpenOnSelect?.(String(option.value))) setOpen(false)
      if (String(option.value) === String(value ?? "")) return
      // Event sintetis: seluruh pemanggil hanya membaca event.target.value.
      onChange?.({
        target: { value: option.value, name, id },
      } as unknown as React.ChangeEvent<HTMLSelectElement>)
    }

    return (
      <div
        ref={containerRef}
        className={cn("relative inline-flex w-full min-w-0 items-center", className)}
        // Inline style menang atas utilitas min-w-0, jadi flex tetap boleh
        // membungkus baris dan tidak memaksa tombol keluar dari kotak induk.
        style={minWidthStyle}
      >
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
          style={minWidthStyle}
        >
          <span
            className={cn("min-w-0 truncate", !selected && !options.some((option) => option.value === "") && "text-muted-foreground")}
            title={selectedLabel}
          >
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

        {matchOptionWidth ? (
          <div
            ref={sizerRef}
            aria-hidden="true"
            className="pointer-events-none invisible absolute left-0 top-0 h-0 w-0 overflow-hidden whitespace-nowrap text-sm"
          >
            {options.map((option) => (
              <span key={option.value || "__empty__"} className="inline-block">
                {option.label}
              </span>
            ))}
          </div>
        ) : null}

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
                        // items-start: label bisa membungkus lebih dari satu baris.
                        "cursor-pointer items-start",
                        isSelected && "bg-primary/10 font-semibold text-primary",
                      )}
                    >
                      <span className="min-w-0 flex-1 break-words leading-snug">
                        {option.label}
                      </span>
                      {isSelected ? <Icon name="check" className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                    </CommandItem>
                  )
                })}
              </CommandList>
              {popoverFooter ? (
                <div
                  // stopPropagation: panel lanjutan tidak boleh diurus cmdk,
                  // supaya tombol panah tetap memindah kursor di input tanggal
                  // dan Enter tetap mengaktifkan tombol Terapkan.
                  onKeyDown={(event) => event.stopPropagation()}
                  className="border-t border-border bg-popover p-2"
                >
                  {popoverFooter}
                </div>
              ) : null}
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
