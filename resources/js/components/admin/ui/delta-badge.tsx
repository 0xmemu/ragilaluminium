import { Icon } from "@/components/shared/icon"
import { formatCurrency, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const MINUS = "\u2212" // U+2212: minus tipografis, bukan hyphen

/**
 * DeltaBadge - SATU-SATUNYA indikator tren angka di panel admin.
 *
 * Dipakai bersama oleh Dashboard dan Performa Toko supaya semantiknya seragam.
 * Sebelumnya ada dua implementasi berbeda (DeltaBadge vs ChangeBadge lokal) yang
 * menghasilkan: perubahan nol tampil "+0%" hijau (seolah naik), desimal bertitik
 * "-1.5%" padahal kontraknya Bahasa Indonesia, dan glyph minus berbeda.
 *
 * Aturan tampilan:
 *   naik        -> ikon naik, "+35,2%"
 *   turun       -> ikon turun, "-35,2%" (minus tipografis)
 *   tetap (0)   -> "Tetap", abu-abu, tanpa ikon dan warna (jujur: tidak berubah)
 *   tanpa data  -> "Baru", abu-abu
 *
 * Warna mengikuti makna, bukan arah angka. Secara bawaan naik dianggap baik
 * (hijau). Untuk metrik yang naik berarti buruk, misalnya Rata-rata Waktu
 * Konfirmasi atau Rasio Pembatalan, beri upIsBad supaya kenaikan tampil merah.
 * Ikon tetap menunjukkan arah angka yang sebenarnya.
 *
 * Angka memakai format Indonesia lewat formatNumber (koma desimal), dan glyph
 * minus tipografis agar sejajar dengan angka tabular.
 */
export function DeltaBadge({
  percent,
  absolute,
  absoluteSuffix,
  absoluteFormat = "number",
  upIsBad = false,
}: {
  percent?: number | null
  absolute?: number
  absoluteSuffix?: string
  /** Bentuk selisih absolut: uang (Rp 1.000) atau angka polos (1.000). */
  absoluteFormat?: "number" | "currency"
  /** Benar untuk metrik yang kenaikannya buruk: warna dibalik, ikon tetap mengikuti arah. */
  upIsBad?: boolean
}) {
  const muted = "text-xs font-medium text-muted-foreground"

  // Pembanding persen tidak tersedia: pakai selisih absolut bila ada, karena
  // "+1 order" lebih informatif daripada sekadar "Baru".
  if (percent === null || percent === undefined) {
    if (absolute !== undefined) {
      if (absolute === 0) {
        return <span className={muted}>Tetap</span>
      }

      const grew = absolute > 0
      const good = upIsBad ? !grew : grew
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium",
            good ? "text-success" : "text-destructive",
          )}
        >
          <Icon name={grew ? "trend-up" : "trend-down"} className="size-3.5" aria-hidden="true" />
          {grew ? "+" : MINUS}{absoluteFormat === "currency" ? " " : ""}
          {absoluteFormat === "currency"
            ? formatCurrency(Math.abs(absolute))
            : formatNumber(Math.abs(absolute))}
          {absoluteSuffix ? " " + absoluteSuffix : ""}
        </span>
      )
    }

    return <span className={muted}>Baru</span>
  }

  // Tidak ada perubahan: netral. Menampilkan "+0%" hijau akan menyesatkan.
  if (percent === 0) {
    return <span className={muted}>Tetap</span>
  }

  const grew = percent > 0
  const good = upIsBad ? !grew : grew
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        good ? "text-success" : "text-destructive",
      )}
    >
      <Icon name={grew ? "trend-up" : "trend-down"} className="size-3.5" aria-hidden="true" />
      {grew ? "+" : MINUS}
      {formatNumber(Math.abs(percent))}%
    </span>
  )
}
