import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

const BADGES = [
  {
    icon: "shield-check" as const,
    title: "Konfirmasi via WhatsApp",
    description: "Detail pesanan dikonfirmasi sebelum produksi",
  },
  {
    icon: "ruler" as const,
    title: "Bisa Custom Ukuran",
    description: "Sesuaikan dengan kebutuhan ruangan Anda",
  },
  {
    icon: "package" as const,
    title: "Packing Aman",
    description: "Produk dikemas dengan rapi dan aman",
  },
  {
    icon: "truck" as const,
    title: "Kirim ke Seluruh Indonesia",
    description: "Pengiriman cepat dan terpercaya",
  },
]

/**
 * Empat keunggulan dalam satu baris (mobile & desktop): ikon kecil di kiri,
 * teks ringkas di kanan — cukup ringkas agar muat di layar 320px.
 */
export function TrustBadgesGrid({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "grid grid-cols-4 gap-x-2 gap-y-3 rounded-lg border border-border bg-surface px-2 py-3 sm:gap-x-3 sm:px-4 sm:py-4",
        className,
      )}
      aria-label="Keunggulan belanja Ragil Aluminium"
    >
      {BADGES.map((badge) => (
        <div
          key={badge.title}
          className="flex min-w-0 items-center gap-1.5 sm:gap-2.5"
        >
          <span className="inline-flex size-5 shrink-0 items-center justify-center text-foreground sm:size-6">
            <Icon name={badge.icon} className="size-5 sm:size-6" weight="regular" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[10px] font-bold leading-tight tracking-tight text-foreground sm:text-xs">
              {badge.title}
            </h3>
            <p className="mt-0.5 hidden leading-4 text-muted-foreground lg:block lg:text-[11px]">
              {badge.description}
            </p>
          </div>
        </div>
      ))}
    </section>
  )
}
