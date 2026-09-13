import { cva, type VariantProps } from "class-variance-authority"

import { Icon } from "@/components/shared/icon"
import { statusMeta } from "@/lib/status"
import { cn } from "@/lib/utils"

/**
 * Admin status badge: pastel solid per tema (bukan tint transparan,
 * bukan solid pekat) dengan teks dan ikon seragam - gelap di light mode,
 * terang di dark mode. Arah owner 13-09: seimbang, tidak terlalu kontras,
 * tidak over saturate, tidak tak terlihat; warna menyesuaikan tema.
 */
const badgeVariants = cva(
  "inline-flex min-h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold leading-none",
  {
    variants: {
      tone: {
        success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        danger: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
        warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
        info: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
        neutral: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
        // Varian lembut lama dilebur ke pasangan warna yang sama.
        "info-soft": "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
        "warning-soft": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
        "success-soft": "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        "neutral-soft": "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
)

/** Ikon per nada, warnanya mewarisi teks (menyesuaikan tema). */
const toneIcon: Record<string, string> = {
  success: "check",
  danger: "x",
  warning: "warning",
  info: "info",
  neutral: "archive",
  "neutral-soft": "circle",
  "info-soft": "info",
  "warning-soft": "warning",
  "success-soft": "check",
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
  const iconName = toneIcon[resolvedTone ?? "neutral"] ?? toneIcon.neutral

  return (
    <span className={cn(badgeVariants({ tone: resolvedTone }), className)}>
      <Icon name={iconName} className="size-3 shrink-0" aria-hidden="true" />
      {label ?? meta.label}
    </span>
  )
}

export { badgeVariants }
