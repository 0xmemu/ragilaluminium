import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export type InstallationLightboxItem = {
  id: number
  url: string
  thumb?: string | null
  is_video?: boolean
  caption?: string | null
}

/**
 * Full-screen lightbox for Hasil Pemasangan with keyboard and swipe navigation.
 */
export function InstallationLightbox({
  open,
  onOpenChange,
  items,
  index,
  onIndexChange,
  productName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: InstallationLightboxItem[]
  index: number
  onIndexChange: (index: number) => void
  productName: string
}) {
  const active = items[index] ?? null
  const total = items.length
  const nextItem = total > 1 ? items[(index + 1) % total] ?? null : null
  const touchStartX = React.useRef<number | null>(null)

  function go(delta: number) {
    if (total < 2) return
    onIndexChange((index + delta + total) % total)
  }

  React.useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") { event.preventDefault(); go(-1) }
      else if (event.key === "ArrowRight") { event.preventDefault(); go(1) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, index, total])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("!fixed !inset-0 !left-0 !top-0 z-modal !flex !h-dvh !max-h-none !w-full !max-w-none", "!translate-x-0 !translate-y-0 !gap-0 !overflow-hidden !rounded-none !border-0", "!bg-foreground/95 !p-0 text-background shadow-none", "[&>button]:right-3 [&>button]:top-3 [&>button]:z-20 [&>button]:text-background")} aria-describedby={undefined}>
        <DialogTitle className="sr-only">{productName}  dokumentasi pemasangan</DialogTitle>
        <DialogDescription className="sr-only">Perbesar foto atau video hasil pemasangan. Geser atau gunakan panah untuk media berikutnya.</DialogDescription>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/55 to-transparent px-4 pb-10 pt-4 pr-16 sm:px-6 sm:pt-5">
          <p className="pointer-events-auto line-clamp-2 max-w-3xl text-sm font-semibold leading-snug tracking-tight text-white sm:text-base">{productName}</p>
          {active ? <p className="pointer-events-auto mt-1 text-xs text-white/70">{active.is_video ? "Video" : "Foto"} {index + 1} dari {total}</p> : null}
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-12 py-16 sm:px-16" onTouchStart={(event) => { touchStartX.current = event.changedTouches[0]?.clientX ?? null }} onTouchEnd={(event) => { const start = touchStartX.current; const end = event.changedTouches[0]?.clientX; touchStartX.current = null; if (start == null || end == null || Math.abs(end - start) < 48) return; go(end > start ? -1 : 1) }}>
          {nextItem ? (
            <div className="pointer-events-none absolute right-0 top-1/2 z-0 hidden h-[min(48dvh,28rem)] w-10 -translate-y-1/2 overflow-hidden rounded-l-md opacity-40 sm:hidden">
              {nextItem.is_video ? (
                <video src={nextItem.thumb ?? nextItem.url} muted playsInline preload="metadata" className="size-full object-cover" />
              ) : (
                <img src={nextItem.thumb ?? nextItem.url} alt="" className="size-full object-cover" />
              )}
            </div>
          ) : null}
          {active ? (
            <div className={cn(
              "relative z-10 flex max-h-[min(72dvh,52rem)] flex-col items-center",
              "motion-safe:animate-[installation-swipe-hint_2.8s_ease-in-out_2]",
              total < 2 && "motion-safe:animate-none",
            )}>
              {active.is_video ? (
                <video
                  key={active.id}
                  src={active.url}
                  controls
                  playsInline
                  className="max-h-[min(72dvh,52rem)] max-w-full bg-black"
                />
              ) : (
                <img
                  key={active.id}
                  src={active.url}
                  alt={active.caption || `${productName}, foto ${index + 1}`}
                  className="max-h-[min(72dvh,52rem)] max-w-full h-auto w-auto"
                />
              )}
              {active?.caption ? (
                <p className="w-full bg-black/55 px-3 py-2 text-center text-sm leading-5 text-white/90">
                  {active.caption}
                </p>
              ) : null}
            </div>
          ) : null}
          {total > 1 ? <><button type="button" onClick={() => go(-1)} className="absolute left-2 top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white" aria-label="Media sebelumnya"><Icon name="caret-left" className="size-5" weight="bold" aria-hidden /></button><button type="button" onClick={() => go(1)} className="absolute right-2 top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white" aria-label="Media berikutnya"><Icon name="caret-right" className="size-5" weight="bold" aria-hidden /></button></> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
