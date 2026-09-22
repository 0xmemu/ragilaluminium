import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Satu komponen hint untuk seluruh panel admin Performa Toko.
 *
 * Muncul saat hover, fokus keyboard, dan ketukan pada layar sentuh; Esc
 * menutup dan fokus tetap di pemicu. Isi hint berasal dari payload atau
 * glosarium halaman, bukan teks yang ditulis ulang per kartu.
 */
export function HintTip({
  label,
  hint,
  className,
}: {
  label: React.ReactNode
  hint?: string
  className?: string
}) {
  const [terbuka, setTerbuka] = React.useState(false)

  if (!hint) return <span className={className}>{label}</span>

  return (
    <span className="relative inline-block">
      <span
        tabIndex={0}
        role="button"
        aria-expanded={terbuka}
        aria-label={
          typeof label === "string" ? label + " keterangan tersedia" : "Keterangan tersedia"
        }
        className={cn(
          "cursor-help underline decoration-muted-foreground/40 decoration-dotted underline-offset-[3px] transition hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          className,
        )}
        onMouseEnter={() => setTerbuka(true)}
        onMouseLeave={() => setTerbuka(false)}
        onFocus={() => setTerbuka(true)}
        onBlur={() => setTerbuka(false)}
        onClick={() => setTerbuka((nilai) => !nilai)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation()
            setTerbuka(false)
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            setTerbuka((nilai) => !nilai)
          }
        }}
      >
        {label}
        {/* Hint tetap ada di DOM sebagai teks pembaca layar: muncul saat
            hover/ketukan untuk mata, dan selalu terbaca oleh sr-only. */}
        <span className="sr-only">. {hint}</span>
      </span>
      {terbuka ? (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-50 mb-1.5 block w-max max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-md"
        >
          {hint}
        </span>
      ) : null}
    </span>
  )
}
