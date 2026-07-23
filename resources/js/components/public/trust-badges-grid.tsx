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

export function TrustBadgesGrid({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "grid gap-6 rounded-lg border border-border bg-surface p-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:p-7",
        className,
      )}
      aria-label="Keunggulan belanja Ragil Aluminium"
    >
      {BADGES.map((badge, index) => (
        <div
          key={badge.title}
          className={cn(
            "flex flex-col items-center px-4 text-center",
            index < BADGES.length - 1 && "lg:border-r lg:border-border",
          )}
        >
          <span className="inline-flex h-11 w-11 items-center justify-center text-foreground">
            <Icon name={badge.icon} className="h-10 w-10" weight="regular" aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-base font-semibold leading-snug tracking-tight text-foreground">
            {badge.title}
          </h3>
          <p className="mt-1.5 max-w-[14rem] text-xs leading-5 text-muted-foreground">
            {badge.description}
          </p>
        </div>
      ))}
    </section>
  )
}
