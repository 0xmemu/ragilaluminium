import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

/**
 * Handle geser untuk mode urut admin (kontrak owner 2026-09-20).
 *
 * Kontrak: geser-urut HANYA lewat ikon tarik di tepi kiri item. Tombol naik/turun
 * (panah atau caret) dilarang, karena memindahkan satu langkah per klik dan
 * membuat baris jadi tinggi. Ikon ini yang menjadi satu-satunya cara menggeser.
 *
 * Saat mode urut nonaktif ikon tetap tampil (redup) supaya kolomnya tidak
 * berubah lebar dan baris tidak melompat ketika mode urut dinyalakan.
 */
export function ReorderDragHandle({
  enabled,
  className,
}: {
  /** Mode urut aktif dan daftar memang bisa digeser. */
  enabled: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground",
        enabled ? "bg-muted hover:text-foreground" : "opacity-30",
        className,
      )}
      aria-hidden="true"
      title={
        enabled
          ? "Tarik untuk memindahkan"
          : "Aktifkan mode urutkan untuk memindahkan"
      }
    >
      <Icon name="dots-six-vertical" className="size-4" />
    </span>
  )
}
