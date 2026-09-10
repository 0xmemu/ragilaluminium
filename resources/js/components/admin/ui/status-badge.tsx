import { cva, type VariantProps } from "class-variance-authority"

import { statusMeta } from "@/lib/status"
import { cn } from "@/lib/utils"

/** Admin status badge - pill tonal lembut dengan dot berwarna (gaya AI-app). */
const badgeVariants = cva(
  "inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-none",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        info: "border-info/20 bg-info/10 text-info",
        warning: "border-warning/25 bg-warning/10 text-warning",
        success: "border-success/20 bg-success/10 text-success",
        danger: "admin-status-danger border-destructive/20 bg-destructive/10 text-red-700",
        "info-soft": "border-info/20 bg-info/10 text-info",
        "warning-soft": "border-warning/25 bg-warning/10 text-warning",
        "success-soft": "border-success/20 bg-success/10 text-success",
        "neutral-soft": "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
)

const dotVariants: Record<string, string> = {
  neutral: "bg-muted-foreground/70",
  info: "bg-info",
  warning: "bg-warning",
  success: "bg-success",
  danger: "bg-destructive",
  "info-soft": "bg-info",
  "warning-soft": "bg-warning",
  "success-soft": "bg-success",
  "neutral-soft": "bg-muted-foreground/70",
}

interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
  status?: unknown
  label?: string
  className?: string
  /** Sembunyikan dot indicator. */
  hideDot?: boolean
}

/** Nada yang sah dipakai apa adanya bila dikirim lewat prop `status`. */
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

export function StatusBadge({ status, label, tone, className, hideDot = false }: StatusBadgeProps) {
  const rawStatus = String(status ?? "")
  const meta = statusMeta(status)
  // Sebagian pemanggil mengirim nada (bukan kunci status) lewat `status`.
  // Tanpa penanganan ini nada tersebut tidak ditemukan di peta dan badge
  // selalu jatuh ke abu-abu netral meski statusnya sehat atau gagal.
  const statusIsTone = DIRECT_TONES.has(rawStatus)
  const resolvedTone = tone ?? (statusIsTone ? (rawStatus as typeof meta.tone) : meta.tone)

  return (
    <span className={cn(badgeVariants({ tone: resolvedTone }), className)}>
      {hideDot ? null : (
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", dotVariants[resolvedTone ?? "neutral"])}
        />
      )}
      {label ?? meta.label}
    </span>
  )
}

export { badgeVariants }
