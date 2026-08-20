import { useEffect, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Fixed commerce action strip above MobileBottomNav (lg:hidden).
 * Spacer is non-interactive height only (do not clone controls).
 */
export function MobileStickyCta({
  children,
  className,
  spacerClassName,
  hideOnTarget,
  hideBelowSection,
  "aria-label": ariaLabel = "Aksi cepat",
}: {
  children: ReactNode
  className?: string
  /** Layout spacer height; must cover sticky bar content. */
  spacerClassName?: string
  /** Sembunyikan bar otomatis saat salah satu elemen target terlihat di viewport (misalnya "#penilaian-ulasan"). */
  hideOnTarget?: string | string[]
  /** Sembunyikan bar TERUS-MENERUS selama viewport sudah melewati/memasuki section ini (hingga scroll naik ke atasnya lagi). Mengukur via getBoundingClientRect sehingga tanpa flicker. */
  hideBelowSection?: string | string[]
  "aria-label"?: string
}) {
  const [hideTargetVisible, setHideTargetVisible] = useState(false)
  const [belowHide, setBelowHide] = useState(false)

  useEffect(() => {
    if (!hideOnTarget) return
    const selectors = Array.isArray(hideOnTarget) ? hideOnTarget : [hideOnTarget]
    const targets = typeof document !== "undefined"
      ? selectors.map((sel) => document.querySelector(sel)).filter((el): el is Element => el !== null)
      : []
    if (targets.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => setHideTargetVisible(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0.05 },
    )
    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [hideOnTarget])

  // Sembunyikan bar terus-menerus selama puncak section ini sudah melewati viewport
  // (kontinu via getBoundingClientRect — tidak ada flicker saat scroll naik/turun).
  useEffect(() => {
    if (!hideBelowSection) return
    const selectors = Array.isArray(hideBelowSection) ? hideBelowSection : [hideBelowSection]
    const tick = () => {
      if (typeof document === "undefined") return
      const vh = window.innerHeight || 0
      let any = false
      for (const sel of selectors) {
        const el = document.querySelector(sel)
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top < vh) {
            any = true
            break
          }
        }
      }
      setBelowHide(any)
    }
    tick()
    window.addEventListener("scroll", tick, { passive: true })
    window.addEventListener("resize", tick)
    return () => {
      window.removeEventListener("scroll", tick)
      window.removeEventListener("resize", tick)
    }
  }, [hideBelowSection])

  const hidden = hideTargetVisible || belowHide

  return (
    <>
      <div
        className={cn("lg:hidden", spacerClassName ?? "h-[calc(var(--mobile-sticky-cta-height)+0.5rem)]")}
        aria-hidden="true"
      />
      <div
        role="region"
        aria-label={ariaLabel}
        className={cn(
          "mobile-sticky-cta border-t border-border bg-surface/95 px-3 py-2.5 shadow-[0_-8px_24px_hsl(var(--foreground)/0.08)] backdrop-blur-md lg:hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
          hidden && "pointer-events-none translate-y-[140%] opacity-0",
          className,
        )}
      >
        <div className="mx-auto flex w-full max-w-lg items-center gap-2">{children}</div>
      </div>
    </>
  )
}
