import { cva, type VariantProps } from "class-variance-authority"

import { statusMeta } from "@/lib/status"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        info: "border-info/20 bg-info/10 text-info",
        warning: "border-warning/25 bg-warning/10 text-warning-foreground",
        success: "border-success/20 bg-success/10 text-success",
        danger: "border-destructive/20 bg-destructive/10 text-destructive",
        // Nada lembut untuk label status sekunder; visual identik dengan nada dasarnya.
        "info-soft": "border-info/20 bg-info/10 text-info",
        "success-soft": "border-success/20 bg-success/10 text-success",
        "warning-soft": "border-warning/25 bg-warning/10 text-warning-foreground",
        "neutral-soft": "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
)

interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
  status?: unknown
  label?: string
  className?: string
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

export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const rawStatus = String(status ?? "")
  const meta = statusMeta(status)
  const statusIsTone = DIRECT_TONES.has(rawStatus)
  const resolvedTone = tone ?? (statusIsTone ? (rawStatus as typeof meta.tone) : meta.tone)

  return (
    <span className={cn(badgeVariants({ tone: resolvedTone }), className)}>
      {label ?? meta.label}
    </span>
  )
}

export { badgeVariants }
