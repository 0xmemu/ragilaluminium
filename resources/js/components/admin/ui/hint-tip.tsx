import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import * as React from "react"

import { cn } from "@/lib/utils"

export interface HintTipProps {
  label: React.ReactNode
  hint?: string
  className?: string
  side?: "top" | "bottom" | "auto"
  align?: "left" | "right" | "auto"
  sideOffset?: number
}

/**
 * Komponen hint terstandar untuk seluruh panel admin.
 *
 * Menggunakan Radix Tooltip Primitive yang dirender lewat Portal (document.body),
 * sehingga dijamin TIDAK PERNAH terpotong oleh card ber-overflow-hidden,
 * tabel ber-overflow-x-auto, atau dialog/drawer ber-overflow-y-auto.
 *
 * Fitur:
 * - Muncul cepat saat kursor diarahkan (hover delay 120ms)
 * - Fokus keyboard (Tab / Shift-Tab)
 * - Ketukan layar sentuh pada mobile / tablet (klik memicu toggle)
 * - Tombol Escape untuk menutup
 * - Penyesuaian batas tabrakan layar otomatis (collisionPadding={8}, flip ke atas/bawah)
 * - Pembaca layar (sr-only)
 */
export function HintTip({
  label,
  hint,
  className,
  side = "auto",
  align = "auto",
  sideOffset = 6,
}: HintTipProps) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLSpanElement>(null)

  // Tutup bila pengguna mengetuk atau mengklik di luar pemicu
  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent | MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  if (!hint) return <span className={className}>{label}</span>

  // Petakan side auto -> Radix side: bila auto, bawaan top dengan avoidCollisions aktif
  // sehingga Radix otomatis membalik (flip) ke bottom jika ruang atas sempit.
  const resolvedSide: "top" | "bottom" =
    side === "bottom" ? "bottom" : "top"

  // Petakan align: right -> end, left -> start, auto -> center
  const resolvedAlign: "start" | "center" | "end" =
    align === "right" ? "end" : align === "left" ? "start" : "center"

  return (
    <TooltipPrimitive.Provider delayDuration={120} skipDelayDuration={250}>
      <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
        <TooltipPrimitive.Trigger asChild>
          <span
            ref={triggerRef}
            tabIndex={0}
            role="button"
            aria-expanded={open}
            aria-label={
              typeof label === "string" ? label + " keterangan tersedia" : "Keterangan tersedia"
            }
            className={cn(
              "cursor-help underline decoration-muted-foreground/40 decoration-dotted underline-offset-[3px] transition hover:decoration-foreground",
              className,
            )}
            onClick={(e) => {
              e.preventDefault()
              setOpen((prev) => !prev)
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation()
                setOpen(false)
              }
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                setOpen((prev) => !prev)
              }
            }}
          >
            {label}
            {/* Hint tetap ada di DOM sebagai teks pembaca layar */}
            <span className="sr-only">. {hint}</span>
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={resolvedSide}
            sideOffset={sideOffset}
            align={resolvedAlign}
            avoidCollisions={true}
            collisionPadding={8}
            className={cn(
              "z-50 max-w-xs sm:max-w-sm rounded-md border border-border bg-popover px-3 py-1.5 text-xs leading-relaxed text-popover-foreground shadow-float animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2",
            )}
          >
            {hint}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
