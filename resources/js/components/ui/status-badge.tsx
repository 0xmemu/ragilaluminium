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

export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const meta = statusMeta(status)

  return (
    <span className={cn(badgeVariants({ tone: tone ?? meta.tone }), className)}>
      {label ?? meta.label}
    </span>
  )
}

export { badgeVariants }
