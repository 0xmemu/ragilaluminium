import * as React from "react"
import { createPortal } from "react-dom"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

export type OptionMenuItem = {
  value: string
  label: string
}

type OptionMenuProps = {
  id?: string
  label: string
  value: string
  options: OptionMenuItem[]
  onChange: (value: string) => void
  className?: string
  align?: "left" | "right"
}

export function OptionMenu({
  id,
  label,
  value,
  options,
  onChange,
  className,
  align = "right",
}: OptionMenuProps) {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const popoverRef = React.useRef<HTMLUListElement>(null)
  // Posisi awal WAJIB sudah fixed dan tersembunyi: kalau dibiarkan kosong ({}),
  // render pertama portal menempel di akhir <body> sebagai elemen alir, jauh di
  // bawah konten, sehingga buka dropdown bisa memicu lompatan scroll.
  const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
    visibility: "hidden",
    zIndex: 60,
  })
  const selected = options.find((option) => option.value === value) ?? options[0]

  React.useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  // Popover dirender lewat portal supaya tidak terpotong ancestor overflow-hidden.
  const positionPopover = React.useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const preferUp = spaceBelow < 240 && rect.top > spaceBelow
    setPopoverStyle({
      position: "fixed",
      left: align === "right" ? undefined : Math.round(rect.left),
      right: align === "right" ? Math.round(window.innerWidth - rect.right) : undefined,
      minWidth: Math.round(rect.width),
      top: preferUp ? undefined : Math.round(rect.bottom + 4),
      bottom: preferUp ? Math.round(window.innerHeight - rect.top + 4) : undefined,
      visibility: "visible",
      zIndex: 60,
    })
  }, [align])

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

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        ref={triggerRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:bg-muted"
      >
        <span className="max-w-[9rem] truncate">{selected?.label ?? label}</span>
        <Icon
          name="chevron-down"
          className={cn("size-3.5 text-muted-foreground transition", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? createPortal(
        <ul
          ref={popoverRef}
          role="listbox"
          aria-label={label}
          style={popoverStyle}
          className="overflow-hidden rounded-md border border-border bg-surface py-1 shadow-md"
        >
          {options.map((option) => {
            const active = option.value === value
            return (
              <li key={option.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-left text-xs font-medium transition",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-muted",
                  )}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  {option.label}
                </button>
              </li>
            )
          })}
        </ul>,
        document.body,
      ) : null}
    </div>
  )
}
