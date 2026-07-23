import { Link, usePage } from "@inertiajs/react"
import { Lightning, SealCheck, Tag } from "@phosphor-icons/react"
import * as React from "react"

import type { Announcement, SharedPageProps } from "@/types"

function AnnouncementMark({ text }: { text: string }) {
  const lower = text.toLowerCase()
  if (lower.includes("flash sale") || lower.includes("flashsale")) {
    return <Lightning weight="fill" className="size-3.5 shrink-0 text-white/90" aria-hidden />
  }
  if (lower.includes("garansi") || lower.includes("cod") || lower.includes("kirim")) {
    return <SealCheck weight="fill" className="size-3.5 shrink-0 text-white/90" aria-hidden />
  }
  if (lower.includes("diskon") || lower.includes("promo") || lower.includes("%")) {
    return <Tag weight="fill" className="size-3.5 shrink-0 text-white/90" aria-hidden />
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

function AnnouncementLink({ announcement }: { announcement: Announcement }) {
  return (
    <Link
      href={announcement.href}
      className="inline-flex shrink-0 items-center gap-2 text-white transition hover:text-white/90"
    >
      <AnnouncementMark text={announcement.text} />
      <AnnouncementText text={announcement.text} />
      <span className="ml-2 text-white/45" aria-hidden="true">
        ◆
      </span>
    </Link>
  )
}

export function AnnouncementBar() {
  const { announcements } = usePage<SharedPageProps>().props
  const items = React.useMemo(() => announcements ?? [], [announcements])

  if (!items.length) return null

  // Duplicate track so the CSS marquee loops seamlessly when only 1–N promos exist.
  const track = items.length === 1 ? [...items, ...items, ...items] : [...items, ...items]

  return (
    <div className="group/announce bg-primary text-white">
      <div className="relative flex min-h-9 items-center overflow-hidden py-2">
        <div
          className="announcement-marquee flex w-max items-center gap-8 whitespace-nowrap will-change-transform sm:gap-10"
          style={{
            animationDuration: `${Math.max(28, track.length * 8)}s`,
          }}
        >
          {track.map((announcement, index) => (
            <AnnouncementLink
              key={`${announcement.text}-${index}`}
              announcement={announcement}
            />
          ))}
        </div>
        <span className="sr-only">
          Promo aktif bergulir: {items.map((item) => item.text).join(". ")}
        </span>
      </div>
    </div>
  )
}
