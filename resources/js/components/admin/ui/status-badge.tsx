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
        // Nada sekunder lembut: tetap dibedakan keluarga warnanya, tapi jauan
        // lebih rendah kontrasnya daripada status event utama pesanan.
        "info-soft": "border-border bg-info/5 text-info/70",
        "warning-soft": "border-border bg-warning/5 text-warning/75",
        "success-soft": "border-border bg-success/5 text-success/70",
        "neutral-soft": "border-border/70 bg-muted/50 text-muted-foreground/80",
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
  "info-soft": "bg-info/50",
  "warning-soft": "bg-warning/50",
  "success-soft": "bg-success/50",
  "neutral-soft": "bg-muted-foreground/40",
}

interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
  status?: unknown
  label?: string
  className?: string
  /** Sembunyikan dot indicator. */
  hideDot?: boolean
}

export function StatusBadge({ status, label, tone, className, hideDot = false }: StatusBadgeProps) {
  const meta = statusMeta(status)
  const resolvedTone = tone ?? meta.tone

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
