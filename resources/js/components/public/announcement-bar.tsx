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

function AnnouncementLink({ announcement }: { announcement: Announcement }) {
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
 * Bar promo statis: menampilkan satu pengumuman teratas (prioritas admin).
 * Tidak ada marquee / rotasi otomatis. Ikon X menutup bar sampai konten berubah.
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
  // Kalau admin mengganti teks/link promo, fingerprint berubah → bar otomatis muncul lagi.
  const dismissed = dismissFingerprint !== null && dismissFingerprint === fingerprint

  // Pastikan index valid saat jumlah item berubah.
  const safeIndex = items.length > 0 ? index % items.length : 0
  const active = items[safeIndex]

  // Slide otomatis antar beberapa pengumuman (jika diaktifkan admin).
  React.useEffect(() => {
    if (!slide.enabled || items.length < 2 || dismissed) return
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (media.matches) return
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length)
    }, Math.max(4000, slide.interval * 1000))
    return () => window.clearInterval(timer)
  }, [slide.enabled, slide.interval, items.length, dismissed, fingerprint])

  if (!active || dismissed) return null

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
      <div className="mx-auto flex min-h-8 w-full max-w-[80rem] items-center justify-center px-9 py-1.5 sm:px-10">
        <AnnouncementLink announcement={active} />
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
