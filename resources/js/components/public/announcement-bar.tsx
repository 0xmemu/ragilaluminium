import { Link, usePage } from "@inertiajs/react"
import { Lightning, SealCheck, Tag } from "@phosphor-icons/react"
import * as React from "react"

import { cn } from "@/lib/utils"
import type { Announcement, SharedPageProps } from "@/types"

const SLIDE_MS = 5500

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

/** Emphasize discount chips / model keywords inside ticker copy. */
function AnnouncementText({ text }: { text: string }) {
  const parts = text.split(/(-?\d{1,3}%)/g)

  return (
    <span className="text-[11px] font-semibold leading-none tracking-tight sm:text-xs">
      {parts.map((part, index) =>
        /^-?\d{1,3}%$/.test(part) ? (
          <span
            key={`${part}-${index}`}
            className="mx-0.5 inline-flex items-center rounded-full bg-white px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-primary sm:text-[11px]"
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

function AnnouncementLink({
  announcement,
  className,
}: {
  announcement: Announcement
  className?: string
}) {
  return (
    <Link
      href={announcement.href}
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-white transition hover:text-white/90 sm:gap-2",
        className,
      )}
    >
      <AnnouncementMark text={announcement.text} />
      <AnnouncementText text={announcement.text} />
    </Link>
  )
}

function MobileAnnouncementCarousel({ items }: { items: Announcement[] }) {
  const [active, setActive] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
  const [reduceMotion, setReduceMotion] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduceMotion(media.matches)
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  React.useEffect(() => {
    setActive((current) => (items.length ? Math.min(current, items.length - 1) : 0))
  }, [items.length])

  React.useEffect(() => {
    if (reduceMotion || paused || items.length <= 1) return
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % items.length)
    }, SLIDE_MS)
    return () => window.clearInterval(id)
  }, [items.length, paused, reduceMotion])

  return (
    <div
      className="relative flex min-h-9 items-center overflow-hidden py-2 md:hidden"
      aria-live="polite"
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false)
        }
      }}
    >
      <div className="relative w-full">
        {items.map((announcement, index) => (
          <div
            key={`${announcement.text}-${index}`}
            className={cn(
              "flex w-full items-center justify-center px-4 text-center",
              index === active ? "relative opacity-100" : "pointer-events-none absolute inset-0 opacity-0",
              !reduceMotion && "transition-opacity duration-[260ms] ease-standard",
            )}
            aria-hidden={index !== active}
          >
            <AnnouncementLink
              announcement={announcement}
              className="max-w-full justify-center [&_span]:max-w-full [&_span]:whitespace-normal [&_span]:text-center"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function DesktopAnnouncementMarquee({ items }: { items: Announcement[] }) {
  // Duplicate track so the CSS marquee loops seamlessly when only 1–N promos exist.
  const track = items.length === 1 ? [...items, ...items, ...items] : [...items, ...items]

  return (
    <div className="group/announce relative hidden min-h-9 items-center overflow-hidden py-2 md:flex">
      <div
        className="announcement-marquee flex w-max items-center gap-8 whitespace-nowrap will-change-transform md:gap-10"
        style={{
          animationDuration: `${Math.max(28, track.length * 8)}s`,
        }}
      >
        {track.map((announcement, index) => (
          <AnnouncementLink
            key={`${announcement.text}-${index}`}
            announcement={announcement}
            className="shrink-0"
          />
        ))}
      </div>
    </div>
  )
}

export function AnnouncementBar() {
  const { announcements } = usePage<SharedPageProps>().props
  const items = React.useMemo(() => announcements ?? [], [announcements])

  if (!items.length) return null

  return (
    <div className="bg-primary text-white">
      <MobileAnnouncementCarousel items={items} />
      <DesktopAnnouncementMarquee items={items} />
      <span className="sr-only">Promo aktif: {items.map((item) => item.text).join(". ")}</span>
    </div>
  )
}
