import { Icon } from "@/components/shared/icon"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * DeltaBadge — indikator perubahan (naik/turun) untuk metrik admin.
 * Hijau untuk naik, merah untuk turun, muted bila tak ada pembanding.
 */
export function DeltaBadge({
  percent,
  absolute,
  absoluteSuffix,
  comparisonLabel = "dari kemarin",
}: {
  percent?: number | null
  absolute?: number
  absoluteSuffix?: string
  comparisonLabel?: string
}) {
  if (absolute !== undefined) {
    const up = absolute >= 0
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium",
          up ? "text-success" : "text-destructive",
        )}
      >
        <Icon
          name="trend-up"
          className={cn("size-3.5", !up && "rotate-180")}
          aria-hidden="true"
        />
        {up ? "+" : ""}
        {formatNumber(absolute)} {absoluteSuffix} {comparisonLabel}
      </span>
    )
  }

  if (percent === null || percent === undefined) {
    return <span className="text-xs text-muted-foreground">Belum ada pembanding</span>
  }

  const up = percent >= 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        up ? "text-success" : "text-destructive",
      )}
    >
      <Icon
        name="trend-up"
        className={cn("size-3.5", !up && "rotate-180")}
        aria-hidden="true"
      />
      {up ? "+" : ""}
      {percent}%
    </span>
  )
}
