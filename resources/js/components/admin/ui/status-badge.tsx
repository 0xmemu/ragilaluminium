import { cva, type VariantProps } from "class-variance-authority"

import { statusMeta } from "@/lib/status"
import { cn } from "@/lib/utils"

/** Admin status badge: latar solid berwarna status, teks monokrom (putih
 * untuk info/success/danger, gelap untuk warning/neutral). Warna status
 * hidup di latar badge, bukan di teks (kontrak owner 2026-09-13). */
const badgeVariants = cva(
  "inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-medium leading-none",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-foreground",
        info: "bg-info text-info-foreground",
        warning: "bg-warning text-black",
        success: "bg-success text-success-foreground",
        danger: "bg-destructive text-destructive-foreground",
        // Varian lembut lama dilebur ke gaya solid agar seluruh panel seragam.
        "info-soft": "bg-info text-info-foreground",
        "warning-soft": "bg-warning text-black",
        "success-soft": "bg-success text-success-foreground",
        "neutral-soft": "bg-muted text-foreground",
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

  return <span className={cn(badgeVariants({ tone: resolvedTone }), className)}>{label ?? meta.label}</span>
}

export { badgeVariants }
