import { Link, usePage } from "@inertiajs/react"
import { Lightning, SealCheck, Tag, X } from "@phosphor-icons/react"
import * as React from "react"

import { cn } from "@/lib/utils"
import type { Announcement, SharedPageProps } from "@/types"

/**
 * Simpan status dismiss per-konten. Kalau admin mengganti teks/link promo
 * (fingerprint berubah), bar otomatis muncul lagi meski sudah ditutup.
 */
const DISMISS_KEY = "ra.announcement.dismissed.v1"

/** Jumlah promo yang ditampilkan sekaligus per slide. */
const ITEMS_PER_ROW = 4

function AnnouncementMark({ text }: { text: string }) {
  const lower = text.toLowerCase()
  if (lower.includes("flash sale") || lower.includes("flashsale")) {
    return <Lightning weight="fill" className="size-3.5 shrink-0 text-white/90" aria-hidden />
  }
  if (lower.includes("garansi") || lower.includes("cod") || lower.includes("kirim")) {
    return <SealCheck weight="fill" className="size-3.5 shrink-0 text-white/90" aria-hidden />
  }
  return <Tag weight="fill" className="size-3.5 shrink-0 text-white/90" aria-hidden />
}

/** Emphasize discount chips / model keywords inside promo copy. */
function AnnouncementText({ text }: { text: string }) {
  const parts = text.split(/(-?\d{1,3}%)/g)

  return (
    <span className="block min-w-0 max-w-full truncate text-xs font-semibold leading-none tracking-tight">
      {parts.map((part, index) =>
        /^-?\d{1,3}%$/.test(part) ? (
          <span
            key={`${part}-${index}`}
            className="mx-0.5 inline-flex items-center rounded-full bg-white px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-primary"
          >
            {part}
          </span>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </span>
  )
}

function AnnouncementItem({ announcement }: { announcement: Announcement }) {
  return (
    <Link
      href={announcement.href}
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 py-2 text-white transition hover:text-white/90 sm:gap-2"
    >
      <AnnouncementMark text={announcement.text} />
      <AnnouncementText text={announcement.text} />
    </Link>
  )
}

/**
 * Bar promo merah: menampilkan beberapa promo sekaligus per slide
 * (3–4 promo per baris, dikelompokkan). Kalau promo lebih dari satu baris,
 * slide berganti kelompok setiap beberapa detik. Ikon X menutup seluruh bar
 * sampai konten berubah.
 */
export function AnnouncementBar({ className }: { className?: string }) {
  const { announcements, announcementSlide } = usePage<SharedPageProps>().props
  const items = React.useMemo(() => announcements ?? [], [announcements])
  const slide = announcementSlide ?? { enabled: false, interval: 5 }
  const [index, setIndex] = React.useState(0)

  const fingerprint = React.useMemo(
    () => items.map((item) => `${item.text}|${item.href}`).join(";;"),
    [items],
  )

  const [dismissFingerprint, setDismissFingerprint] = React.useState<string | null>(() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY)
    } catch {
      return null
    }
  })

  // Derived, tanpa effect: bar tertutup hanya jika fingerprint tersimpan == fingerprint saat ini.
  const dismissed = dismissFingerprint !== null && dismissFingerprint === fingerprint

  if (!items.length || dismissed) return null

  // Kelompokkan promo per slide: 3–4 promo per baris.
  const perRow = ITEMS_PER_ROW
  const totalRows = Math.ceil(items.length / perRow)

  const chunk = (list: Announcement[], size: number): Announcement[][] =>
    Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
      list.slice(i * size, i * size + size),
    )

  const rows = chunk(items, perRow)

  // Slide otomatis antar kelompok promo (jika lebih dari satu kelompok).
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

  React.useEffect(() => {
    if (totalRows < 2 || dismissed || reduceMotion) return
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % totalRows)
    }, Math.max(4000, slide.interval * 1000))
    return () => window.clearInterval(timer)
  }, [totalRows, dismissed, reduceMotion, slide.interval])

  const safeIndex = totalRows > 0 ? index % totalRows : 0

  function dismiss() {
    setDismissFingerprint(fingerprint)
    try {
      window.localStorage.setItem(DISMISS_KEY, fingerprint)
    } catch {
      // non-persistent close (private mode, etc.)
    }
  }

  return (
    <div className={cn("relative bg-primary text-white", className)}>
      <div className="relative mx-auto flex min-h-8 w-full max-w-[80rem] items-stretch overflow-hidden px-9 sm:px-10">
        {/* Track: slide bergeser horizontal per kelompok promo */}
        <div
          className={cn(
            "flex h-full w-full",
            !reduceMotion && "transition-transform duration-[400ms] ease-emphasized",
          )}
          style={{ transform: `translateX(-${safeIndex * 100}%)` }}
        >
          {rows.map((row, rowIndex) => (
            <div
              key={`d${rowIndex}`}
              className="grid h-full w-full shrink-0 basis-full grid-cols-4 items-stretch"
              aria-hidden={rowIndex !== safeIndex ? "true" : undefined}
            >
              {row.map((item) => (
                <div key={item.text + item.href} className="flex min-w-0 items-center justify-center px-2 sm:px-3">
                  <AnnouncementItem announcement={item} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Dots — hanya kalau promo lebih dari satu kelompok */}
        {totalRows > 1 ? (
          <div className="absolute inset-x-0 -bottom-1 flex justify-center gap-1.5">
            {Array.from({ length: totalRows }).map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                onClick={() => setIndex(dotIndex)}
                aria-label={`Slide ${dotIndex + 1}`}
                aria-current={dotIndex === safeIndex ? "true" : undefined}
                className="relative flex size-4 items-center justify-center before:absolute before:-inset-2 before:content-['']"
              >
                <span
                  className={cn(
                    "h-1 rounded-full transition-all",
                    dotIndex === safeIndex ? "w-3 bg-white" : "w-1 bg-white/50",
                  )}
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Tutup bar promo"
        className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-white/90 transition before:absolute before:-inset-2.5 before:content-[''] hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <X weight="bold" className="size-4" aria-hidden />
      </button>
      <span className="sr-only">Promo aktif: {items.map((item) => item.text).join(". ")}</span>
    </div>
  )
}
