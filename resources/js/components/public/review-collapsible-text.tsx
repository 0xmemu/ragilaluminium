import * as React from "react"

import { cn } from "@/lib/utils"

/** Gaya tombol "Lihat selengkapnya" pada teks ulasan dan balasan. */
const TOGGLE_CLASS =
  "mt-0.5 inline-block cursor-pointer text-[11px] font-semibold text-primary underline-offset-2 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

/**
 * Teks ulasan atau balasan admin dengan tombol "Lihat selengkapnya".
 *
 * `line-clamp` memotong teks tanpa memberi cara membacanya utuh, padahal
 * ulasan panjang justru memuat detail yang dicari pembeli. Tombol hanya muncul
 * bila teks benar-benar terpotong, supaya kartu berisi teks pendek tidak
 * dipenuhi tombol yang tidak berguna.
 *
 * Kartu ulasan di /reviews/web membungkus isinya dengan <Link>, dan <button>
 * di dalam <a> bukan HTML yang sah. Karena itu di konteks itu tombolnya
 * dirender sebagai elemen non-tombol, tetapi kliknya tetap dihentikan supaya
 * tidak ikut membuka tautan kartu.
 */
export function ReviewCollapsibleText({
  text,
  className,
  clampClassName = "line-clamp-3",
  insideLink = false,
}: {
  text: string
  className?: string
  /** Kelas pembatas tinggi saat ringkas, mis. "line-clamp-3". */
  clampClassName?: string
  /** true bila komponen berada di dalam <a> atau <Link>. */
  insideLink?: boolean
}) {
  const [expanded, setExpanded] = React.useState(false)
  const [truncated, setTruncated] = React.useState(false)
  const textRef = React.useRef<HTMLParagraphElement>(null)

  React.useEffect(() => {
    const el = textRef.current
    if (!el || expanded) return

    const measure = () => setTruncated(el.scrollHeight - el.clientHeight > 1)

    // Pengukuran pertama dijalankan langsung supaya tombol tidak menunggu
    // observer lebih dulu. Elemen yang di-clamp tetap melaporkan tinggi teks
    // penuh lewat scrollHeight di browser sasaran, jadi selisihnya cukup untuk
    // memutuskan teks benar-benar terpotong atau tidak.
    measure()

    // Susunan akhir (font web, lebar kontainer) bisa terbentuk setelah paint
    // pertama. Perubahan itu tidak selalu memicu ResizeObserver, karena tinggi
    // kotak yang di-clamp tetap sama walau jumlah baris teks aslinya bertambah.
    // Akibatnya tombol "Lihat selengkapnya" bisa hilang pada teks yang justru
    // terpotong, jadi pengukuran diulang setelah font siap.
    document.fonts?.ready.then(measure).catch(() => {})

    // Lebar kartu berubah saat carousel digeser atau viewport diubah; lebar
    // induk dipakai karena kotak yang di-clamp sendiri tingginya tetap.
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    if (el.parentElement) observer.observe(el.parentElement)
    return () => observer.disconnect()
  }, [expanded, text])

  function handleExpand(event: React.MouseEvent | React.KeyboardEvent) {
    event.preventDefault()
    event.stopPropagation()
    setExpanded(true)
  }

  const showToggle = truncated && !expanded

  return (
    <>
      <p ref={textRef} className={cn(className, !expanded && clampClassName)}>
        {text}
      </p>
      {showToggle ? (
        insideLink ? (
          <span
            role="button"
            tabIndex={0}
            onClick={handleExpand}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") handleExpand(event)
            }}
            className={TOGGLE_CLASS}
          >
            Lihat selengkapnya
          </span>
        ) : (
          <button type="button" onClick={handleExpand} className={TOGGLE_CLASS}>
            Lihat selengkapnya
          </button>
        )
      ) : null}
    </>
  )
}
