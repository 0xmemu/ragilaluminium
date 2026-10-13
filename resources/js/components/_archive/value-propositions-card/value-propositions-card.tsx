import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

/** Value Propositions halaman cart/checkout — 4 kolom ikon + label + keterangan (sesuai standar TaaFn). */
const PROPOSITIONS = [
  {
    icon: "shield-check",
    label: "Konfirmasi via WhatsApp",
    desc: "Detail pesanan dikonfirmasi sebelum produksi",
  },
  {
    icon: "ruler",
    label: "Bisa Custom Ukuran",
    desc: "Sesuaikan dengan kebutuhan ruangan Anda",
  },
  {
    icon: "package",
    label: "Gratis packing kayu",
    desc: "Produk dikemas dengan rapi dan aman",
  },
  {
    icon: "truck",
    label: "Kirim ke Seluruh Indonesia",
    desc: "Pengiriman cepat dan terpercaya",
  },
] as const

export function ValuePropositionsCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-muted/50 px-2 py-3 shadow-[0_2px_8px_hsl(var(--foreground)/0.04)]",
        className,
      )}
    >
      <ul className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-4">
        {PROPOSITIONS.map((item) => (
          <li
            key={item.label}
            className="flex min-w-0 flex-col items-center gap-1 px-1 text-center"
          >
            <Icon
              name={item.icon}
              className="size-5 shrink-0 text-foreground"
              weight="regular"
              aria-hidden="true"
            />
            <span className="text-[11px] font-bold leading-tight tracking-tight text-foreground">
              {item.label}
            </span>
            <span className="text-[10px] leading-tight text-muted-foreground">
              {item.desc}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
