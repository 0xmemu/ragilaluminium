import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Satu komponen hint untuk seluruh panel admin Performa Toko.
 *
 * Muncul saat hover, fokus keyboard, dan ketukan pada layar sentuh; Esc
 * menutup dan fokus tetap di pemicu. Isi hint berasal dari payload atau
 * glosarium halaman, bukan teks yang ditulis ulang per kartu.
 *
 * Mendukung penentuan arah (side) dan perataan (align): bila posisi pemicu
 * dekat dengan batas atas viewport (< 140px), tooltip otomatis terbuka ke bawah
 * agar tidak terpotong oleh viewport atau wadah drawer overflow-y-auto.
 */
export function HintTip({
  label,
  hint,
  className,
  side = "auto",
  align = "auto",
}: {
  label: React.ReactNode
  hint?: string
  className?: string
  side?: "top" | "bottom" | "auto"
  align?: "left" | "right" | "auto"
}) {
  const [terbuka, setTerbuka] = React.useState(false)
  const [bukaBawah, setBukaBawah] = React.useState(side === "bottom")
  const [rataKanan, setRataKanan] = React.useState(align === "right")
  const pemicuRef = React.useRef<HTMLSpanElement>(null)

  const hitungPosisi = React.useCallback(() => {
    if (side === "bottom") {
      setBukaBawah(true)
    } else if (side === "top") {
      setBukaBawah(false)
    } else {
      // Auto: jika pemicu dekat batas atas viewport (< 140px), buka ke bawah
      // agar tidak terpotong oleh viewport atau wadah overflow-y-auto drawer.
      const rect = pemicuRef.current?.getBoundingClientRect()
      if (rect) {
        setBukaBawah(rect.top < 240)
      }
    }

    if (align === "right") {
      setRataKanan(true)
    } else if (align === "left") {
      setRataKanan(false)
    } else {
      // Auto: jika pemicu dekat tepi kanan layar (< 280px), rata kanan pemicu
      const rect = pemicuRef.current?.getBoundingClientRect()
      if (rect) {
        setRataKanan(window.innerWidth - rect.left < 280)
      }
    }
  }, [side, align])

  const tampilkan = () => {
    hitungPosisi()
    setTerbuka(true)
  }

  const sembunyikan = () => {
    setTerbuka(false)
  }

  // Tutup bila pengguna mengetuk atau mengklik di luar pemicu
  React.useEffect(() => {
    if (!terbuka) return
    const padaKlikDokumen = (event: MouseEvent) => {
      if (pemicuRef.current && !pemicuRef.current.contains(event.target as Node)) {
        setTerbuka(false)
      }
    }
    document.addEventListener("click", padaKlikDokumen)
    return () => document.removeEventListener("click", padaKlikDokumen)
  }, [terbuka])

  if (!hint) return <span className={className}>{label}</span>

  return (
    <span ref={pemicuRef} className="relative inline-block">
      <span
        tabIndex={0}
        role="button"
        aria-expanded={terbuka}
        aria-label={
          typeof label === "string" ? label + " keterangan tersedia" : "Keterangan tersedia"
        }
        className={cn(
          "cursor-help underline decoration-muted-foreground/40 decoration-dotted underline-offset-[3px] transition hover:decoration-foreground",
          className,
        )}
        onMouseEnter={tampilkan}
        onMouseLeave={sembunyikan}
        onFocus={tampilkan}
        onBlur={sembunyikan}
        onClick={() => {
          if (!terbuka) hitungPosisi()
          setTerbuka((nilai) => !nilai)
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation()
            sembunyikan()
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            if (!terbuka) hitungPosisi()
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
          className={cn(
            "absolute z-50 block w-max max-w-xs sm:max-w-sm rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs leading-relaxed text-popover-foreground shadow-md",
            bukaBawah ? "top-full mt-1.5" : "bottom-full mb-1.5",
            rataKanan ? "right-0" : "left-0",
          )}
        >
          {hint}
        </span>
      ) : null}
    </span>
  )
}
