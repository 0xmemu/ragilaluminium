import { Icon } from "@/components/shared/icon"
import { StatusBadge } from "@/components/ui/status-badge"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { PublicOrder } from "@/types"

const STEPS = [
  { status: "pending_payment", label: "Pesanan dibuat", hint: "Menunggu konfirmasi" },
  { status: "processing", label: "Diproses", hint: "Produksi oleh toko" },
  { status: "shipped", label: "Dikirim", hint: "Dalam perjalanan" },
  { status: "delivered", label: "Sampai", hint: "Paket diterima" },
  { status: "completed", label: "Selesai", hint: "Pesanan selesai" },
] as const

const MESSAGE_KEYWORDS: Record<(typeof STEPS)[number]["status"], string[]> = {
  pending_payment: ["menunggu konfirmasi", "dibuat"],
  processing: ["diproses oleh toko", "diproses"],
  shipped: ["sedang dikirim", "resi pengiriman", "diterbitkan"],
  delivered: ["berhasil diterima", "paket diterima"],
  completed: ["selesai"],
}

function dateForStep(
  status: string,
  timeline: Array<{ message: string; at?: string | null }> | undefined,
): string | undefined {
  const keywords = MESSAGE_KEYWORDS[status as keyof typeof MESSAGE_KEYWORDS] ?? []
  const entry = (timeline ?? []).find((item) =>
    keywords.some((keyword) => (item.message ?? "").toLowerCase().includes(keyword)),
  )
  return entry?.at ?? undefined
}

/**
 * Lacak pesanan sisi pembeli: milestone status pesanan (dari order_status asli)
 * dengan tanggal dari timeline event, plus banner status khusus (batal/retur/issue).
 * Terintegrasi penuh dengan data nyata — bukan dummy.
 */
export function OrderProgressTracker({ order }: { order: PublicOrder }) {
  const currentIndex = STEPS.findIndex((step) => step.status === order.order_status)

  const specialMeta: Record<
    string,
    { icon: string; tone: "danger" | "warning" | "success"; title: string; description: string }
  > = {
    cancelled: {
      icon: "x",
      tone: "danger",
      title: "Pesanan dibatalkan",
      description: "Pesanan ini telah dibatalkan dan tidak dapat dilanjutkan.",
    },
    issue: {
      icon: "warning",
      tone: "warning",
      title: "Perlu perhatian",
      description: "Ada kendala pada pesanan. Tim kami akan menghubungi Anda via WhatsApp.",
    },
    return_in_process: {
      icon: "package",
      tone: "warning",
      title: "Retur sedang diproses",
      description: "Pesanan dalam proses retur. Tim kami akan memberi kabar selanjutnya.",
    },
    return_completed: {
      icon: "check-circle",
      tone: "success",
      title: "Retur selesai",
      description: "Proses retur telah selesai.",
    },
  }
  const special = specialMeta[order.order_status] ?? null

  const timeline = order.tracking?.timeline

  return (
    <div className="space-y-4">
      {special ? (
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border p-4",
            special.tone === "danger" && "border-destructive/30 bg-destructive/5",
            special.tone === "warning" && "border-warning/40 bg-warning/10",
            special.tone === "success" && "border-success/40 bg-success/10",
          )}
        >
          <Icon
            name={special.icon}
            className={cn(
              "mt-0.5 size-5 shrink-0",
              special.tone === "danger" && "text-destructive",
              special.tone === "warning" && "text-warning",
              special.tone === "success" && "text-success",
            )}
            weight="bold"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-bold text-foreground">{special.title}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{special.description}</p>
          </div>
        </div>
      ) : null}

      <ol className="space-y-0">
        {STEPS.map((step, index) => {
          const done = currentIndex >= 0 && index < currentIndex
          const current = currentIndex === index
          const date = dateForStep(step.status, timeline)

          return (
            <li key={step.status} className="relative flex gap-3 pb-5 last:pb-0">
              {index < STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-0.5",
                    index < currentIndex ? "bg-primary/50" : "bg-border",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                  done && "border-primary bg-primary text-primary-foreground",
                  current && "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15",
                  !done && !current && "border-border bg-surface text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {done ? (
                  <Icon name="check" className="size-3.5" weight="bold" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </span>
              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      current ? "text-foreground" : done ? "text-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </p>
                  {current ? <StatusBadge status={order.order_status} /> : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.hint}</p>
                {date ? (
                  <p className="mt-0.5 text-xs font-medium text-primary">{formatDate(date)}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
