import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

export function TrustAssuranceCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-border bg-surface-muted px-3 py-3.5",
        className,
      )}
    >
      <Icon
        name="shield-check"
        className="mt-0.5 h-6 w-6 shrink-0 text-foreground"
        weight="regular"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-tight text-foreground">Belanja Aman & Terpercaya</p>
        <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
          Garansi jika produk rusak, pengiriman aman, dan pelayanan terbaik.
        </p>
      </div>
    </div>
  )
}
