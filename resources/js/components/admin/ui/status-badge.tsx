import { cva, type VariantProps } from "class-variance-authority"

import { Icon } from "@/components/shared/icon"
import { statusMeta } from "@/lib/status"
import { cn } from "@/lib/utils"

/**
 * Admin status badge (referensi gaya owner 13-09): pil solid berwarna
 * status dengan teks monokrom dan ikon di dalam chip mini kontras.
 * Teks hanya hitam atau putih; warna status hidup di latar badge.
 */
const badgeVariants = cva(
  "inline-flex min-h-7 items-center gap-1.5 rounded-full pl-2 pr-3 text-xs font-semibold leading-none",
  {
    variants: {
      tone: {
        success: "bg-success text-white",
        danger: "bg-destructive text-white",
        warning: "bg-warning text-zinc-950",
        info: "bg-info text-white",
        neutral: "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950",
        // Varian lembut lama dilebur ke gaya solid agar seluruh panel seragam.
        "info-soft": "bg-info text-white",
        "warning-soft": "bg-warning text-zinc-950",
        "success-soft": "bg-success text-white",
        "neutral-soft": "bg-white text-zinc-950 border border-zinc-950 dark:bg-zinc-100 dark:border-transparent",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
)

/** Ikon + chip mini kontras per nada (chip membalik warna latar badge). */
const toneIcon: Record<string, { name: string; chip: string }> = {
  success: { name: "check", chip: "bg-zinc-950 text-white" },
  danger: { name: "x", chip: "bg-white text-zinc-950" },
  warning: { name: "warning", chip: "bg-zinc-950 text-white" },
  info: { name: "info", chip: "bg-zinc-950 text-white" },
  neutral: { name: "archive", chip: "bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white" },
  "neutral-soft": { name: "circle", chip: "bg-zinc-950 text-white" },
  "info-soft": { name: "info", chip: "bg-zinc-950 text-white" },
  "warning-soft": { name: "warning", chip: "bg-zinc-950 text-white" },
  "success-soft": { name: "check", chip: "bg-zinc-950 text-white" },
}

interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
  status?: unknown
  label?: string
  className?: string
}

/** Nada yang sah dipakai apa adanya bila dikirim lewat prop . */
const DIRECT_TONES = new Set([
  "neutral",
  "info",
  "warning",
  "success",
  "danger",
  "info-soft",
  "warning-soft",
  "success-soft",
  "neutral-soft",
])

export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const rawStatus = String(status ?? "")
  const meta = statusMeta(status)
  // Sebagian pemanggil mengirim nada (bukan kunci status) lewat .
  // Tanpa penanganan ini nada tersebut tidak ditemukan di peta dan badge
  // selalu jatuh ke abu-abu netral meski statusnya sehat atau gagal.
  const statusIsTone = DIRECT_TONES.has(rawStatus)
  const resolvedTone = tone ?? (statusIsTone ? (rawStatus as typeof meta.tone) : meta.tone)
  const icon = toneIcon[resolvedTone ?? "neutral"] ?? toneIcon.neutral

  return (
    <span className={cn(badgeVariants({ tone: resolvedTone }), className)}>
      <span
        aria-hidden="true"
        className={cn("flex size-4 shrink-0 items-center justify-center rounded-full", icon.chip)}
      >
        <Icon name={icon.name} className="size-2.5" aria-hidden="true" />
      </span>
      {label ?? meta.label}
    </span>
  )
}

export { badgeVariants }
