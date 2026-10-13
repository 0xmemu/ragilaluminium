import { cva, type VariantProps } from "class-variance-authority"

import { Icon } from "@/components/shared/icon"
import { statusIcon, statusMeta } from "@/lib/status"
import { cn } from "@/lib/utils"

/**
 * Admin status badge (owner 16-09: bedakan light & dark mode):
 * - Light mode: latar pastel lembut (100) dengan teks berwarna tua (800) yang elegan di kartu putih.
 * - Dark mode: pil solid pekat/matang (400/500, non-pastel) dengan teks & ikon hitam pekat kontras tinggi.
 */
/**
 * Admin status badge (gaya border + tint transparan, disamakan dengan Catatan Admin):
 * - Border halus semi-transparan per warna status (border-*-500/50 dark:border-*-500/40)
 * - Latar tint transparan lembut (bg-*-500/15)
 * - Teks & ikon: gelap di light mode (text-*-800), terang/light di dark mode (dark:text-*-300)
 */
const badgeVariants = cva(
  "inline-flex min-h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold leading-none",
  {
    variants: {
      tone: {
        success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:border-emerald-500/40 dark:text-emerald-300",
        danger: "border-red-500/40 bg-red-500/15 text-red-800 dark:border-red-500/40 dark:text-red-300",
        warning: "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:border-amber-500/40 dark:text-amber-300",
        info: "border-sky-500/40 bg-sky-500/15 text-sky-800 dark:border-sky-500/40 dark:text-sky-300",
        neutral: "border-zinc-500/40 bg-zinc-500/15 text-zinc-700 dark:border-zinc-500/40 dark:text-zinc-300",
        // Varian lembut
        "info-soft": "border-sky-500/40 bg-sky-500/15 text-sky-800 dark:border-sky-500/40 dark:text-sky-300",
        "warning-soft": "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:border-amber-500/40 dark:text-amber-300",
        "success-soft": "border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:border-emerald-500/40 dark:text-emerald-300",
        "neutral-soft": "border-zinc-500/40 bg-zinc-500/15 text-zinc-700 dark:border-zinc-500/40 dark:text-zinc-300",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
)

/**
 * Ikon per nada, warnanya mewarisi teks (menyesuaikan tema). Dipakai sebagai
 * bawaan untuk status yang tidak punya ikon spesifik di lib/status.ts.
 * Tidak ada nada yang memakai "circle": lingkaran kosong tidak bermakna.
 */
const toneIcon: Record<string, string> = {
  success: "check",
  danger: "x",
  warning: "warning",
  info: "info",
  neutral: "archive",
  "neutral-soft": "minus",
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
  // Ikon spesifik status menang; bila pemanggil mengirim nada langsung
  // (bukan kunci status), statusIcon tidak cocok dan jatuh ke ikon nada.
  const iconName = (!statusIsTone && statusIcon(status)) || toneIcon[resolvedTone ?? "neutral"] || toneIcon.neutral

  return (
    <span className={cn(badgeVariants({ tone: resolvedTone }), className)}>
      <Icon name={iconName} className="size-3 shrink-0" aria-hidden="true" />
      {label ?? meta.label}
    </span>
  )
}

export { badgeVariants }
