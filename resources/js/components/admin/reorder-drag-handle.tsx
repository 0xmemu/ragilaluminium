import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

/**
 * Ikon tarik untuk mode Urutkan admin (kontrak owner 2026-09-20, direvisi).
 *
 * Kontrak: memindahkan baris HANYA lewat ikon tarik di tepi paling kiri item.
 * Tombol naik/turun (panah atau caret) dilarang, karena memindahkan satu langkah
 * per klik dan membuat baris jadi tinggi. Ikon ini satu-satunya cara memindahkan.
 *
 * Saat prop enabled bernilai false komponen mengembalikan null, sehingga halaman
 * pemakainya tidak merender kolom sama sekali lewat th / td yang kondisional.
 * Klausul lama kontrak 2026-09-20 yang menampilkan ikon redup saat mode Urutkan
 * belum aktif sudah DIGANTIKAN dan tidak berlaku lagi: ikon redup terbaca sebagai
 * kontrol rusak sekaligus menyisakan kolom kosong yang menganga.
 */
export function ReorderDragHandle({
  enabled,
  className,
}: {
  /** Mode Urutkan aktif dan baris ini memang bisa dipindahkan. */
  enabled: boolean
  className?: string
}) {
  if (!enabled) return null

  return (
    <span
      className={cn(
        // Kursor tarik duduk di handle, bukan di seluruh baris: di dalam baris ada
        // tombol dan dropdown yang akan salah tampil kalau barisnya ikut grab.
        "inline-flex size-7 cursor-grab items-center justify-center rounded-md bg-muted text-muted-foreground hover:text-foreground active:cursor-grabbing",
        className,
      )}
      data-reorder-handle
      aria-hidden="true"
      title="Tarik untuk memindahkan"
    >
      <Icon name="dots-six-vertical" className="size-4" />
    </span>
  )
}
