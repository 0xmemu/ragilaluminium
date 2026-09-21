import { Icon } from "@/components/shared/icon"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/admin/ui/tooltip"
import { barisBandingkan, type DeltaComparison } from "@/lib/delta-comparison"
import { formatCurrency, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

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
 * Keterangan saat kursor diarahkan. Bila `comparison` diberikan, badge menjadi
 * bisa diarahkan kursor dan memunculkan nilai periode ini, nilai periode
 * sebelumnya, dan rentang pembandingnya. Persentase saja tidak cukup: naik 380
 * persen dari angka besar dan dari nol adalah dua keadaan yang berbeda. Metrik
 * bercakupan sekarang tidak diberi keterangan ini, karena angkanya memang tidak
 * dibandingkan dengan periode sebelumnya.
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
  comparison,
  comparisonLabel = "Perbandingan periode",
}: {
  percent?: number | null
  absolute?: number
  absoluteSuffix?: string
  /** Bentuk selisih absolut: uang (Rp 1.000) atau angka polos (1.000). */
  absoluteFormat?: "number" | "currency"
  /** Benar untuk metrik yang kenaikannya buruk: warna dibalik, ikon tetap mengikuti arah. */
  upIsBad?: boolean
  /** Nilai periode ini dan sebelumnya. Bila ada, badge bisa diarahkan kursor. */
  comparison?: DeltaComparison
  comparisonLabel?: string
}) {
  const muted = "text-xs font-medium text-muted-foreground"

  let isi: ReactNode

  // Pembanding persen tidak tersedia: pakai selisih absolut bila ada, karena
  // "+1 order" lebih informatif daripada sekadar "Baru".
  if (percent === null || percent === undefined) {
    if (absolute !== undefined) {
      if (absolute === 0) {
        isi = <span className={muted}>Tetap</span>
      } else {
        const grew = absolute > 0
        const good = upIsBad ? !grew : grew
        isi = (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              good ? "text-success" : "text-destructive",
            )}
          >
            <Icon name={grew ? "trend-up" : "trend-down"} className="size-3.5" aria-hidden="true" />
            {grew ? "+" : MINUS}
            {absoluteFormat === "currency" ? " " : ""}
            {absoluteFormat === "currency"
              ? formatCurrency(Math.abs(absolute))
              : formatNumber(Math.abs(absolute))}
            {absoluteSuffix ? " " + absoluteSuffix : ""}
          </span>
        )
      }
    } else {
      isi = <span className={muted}>Baru</span>
    }
  } else if (percent === 0) {
    // Tidak ada perubahan: netral. Menampilkan "+0%" hijau akan menyesatkan.
    isi = <span className={muted}>Tetap</span>
  } else {
    const grew = percent > 0
    const good = upIsBad ? !grew : grew
    isi = (
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

  // Tanpa keterangan pembanding, tampilannya sama seperti sebelumnya.
  if (!comparison) return <>{isi}</>

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex cursor-help rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {isi}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-0.5 text-left">
            <p className="font-medium">{comparisonLabel}</p>
            {barisBandingkan(comparison).map((baris) => (
              <p key={baris}>{baris}</p>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}