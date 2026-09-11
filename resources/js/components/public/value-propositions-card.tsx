import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

/** Value Propositions halaman checkout — 4 kolom ikon + label + keterangan. */
const PROPOSITIONS = [
  {
    icon: "headset",
    label: "Konsultasi Gratis",
    desc: "Tanya ukuran & model via WhatsApp",
  },
  {
    icon: "pencil-simple",
    label: "Catatan Produk",
    desc: "Tulis permintaan khusus",
  },
  {
    icon: "shield-check",
    label: "Garansi 100%",
    desc: "Kualitas terjamin",
  },
  {
    icon: "box",
    label: "Packing Aman",
    desc: "Pengiriman J&T Cargo",
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
              className={cn(
                "size-5 shrink-0",
                item.icon === "shield-check" ? "text-copper" : "text-foreground",
              )}
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
