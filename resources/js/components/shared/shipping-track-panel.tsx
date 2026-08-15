import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { formatDateTime } from "@/lib/format"
import { SHIPPING_STEPS, shippingStepIndex, statusMeta } from "@/lib/status"
import { cn } from "@/lib/utils"

export type ShippingTrackData = {
  shipping_status: string
  carrier_name?: string | null
  waybill_number?: string | null
  record_status?: string | null
  status_raw?: string | null
  last_status_at?: string | null
  tracking_url?: string | null
  order_status?: string | null
}

type ShippingTrackPanelProps = {
  track: ShippingTrackData
  jntEnabled?: boolean
  compact?: boolean
  className?: string
  onRefresh?: () => void
  refreshBusy?: boolean
  onCopyWaybill?: (waybill: string) => void
}

export function ShippingTrackPanel({
  track,
  jntEnabled = false,
  compact = false,
  className,
  onRefresh,
  refreshBusy = false,
  onCopyWaybill,
}: ShippingTrackPanelProps) {
  const activeStatus = (track.record_status || track.shipping_status || "").trim() || "unknown"
  const normalizedStatus = activeStatus.toLowerCase()
  const knownStatuses = new Set([...SHIPPING_STEPS, "cancelled", "returned"])
  const isCancelled = normalizedStatus === "cancelled"
  const isReturned = normalizedStatus === "returned"
  const isUnknown = !knownStatuses.has(normalizedStatus)
  const stepIndex = shippingStepIndex(activeStatus)
  const hasWaybill = Boolean(track.waybill_number)
  const orderMeta = statusMeta(track.order_status || "")

  if (compact) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <StatusBadge status={activeStatus} />
        {hasWaybill ? (
          <span className="font-mono text-[11px] text-muted-foreground">{track.waybill_number}</span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Menunggu resi</span>
        )}
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Status pengiriman</p>
          <div className="mt-1.5">
            <StatusBadge status={activeStatus} />
          </div>
        </div>
        {hasWaybill && onRefresh ? (
          <Button
            type="button"
            variant="secondary"
            size="xs"
            disabled={refreshBusy || !jntEnabled}
            onClick={onRefresh}
            title={jntEnabled ? "Refresh status dari J&T" : "J&T belum aktif — refresh nonaktif"}
          >
            {refreshBusy ? "Memuat..." : "Refresh J&T"}
          </Button>
        ) : null}
      </div>

      {isCancelled ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs leading-5 text-destructive">
          <p className="font-semibold">Pengiriman dibatalkan</p>
          <p className="text-destructive/80">Tidak ada pembaruan tracking lanjutan untuk pengiriman ini.</p>
        </div>
      ) : isReturned ? (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs leading-5 text-warning-foreground">
          <p className="font-semibold">Paket dikembalikan</p>
          <p className="text-warning-foreground/80">Status pengiriman menunjukkan paket sedang atau sudah dikembalikan ke toko.</p>
        </div>
      ) : isUnknown ? (
        <div className="rounded-md border border-border bg-surface-muted px-3 py-2.5 text-xs leading-5 text-muted-foreground">
          <p className="font-semibold text-foreground">Status pengiriman belum dikenali</p>
          <p>Informasi dari kurir belum dapat dipetakan. Tim toko akan memeriksa pembaruan berikutnya.</p>
        </div>
      ) : null}

      {!hasWaybill && !isCancelled && !isReturned ? (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs leading-5">
          <p className="font-semibold text-foreground">Menunggu resi pengiriman</p>
          <p className="mt-0.5 text-muted-foreground">
            Posisi pesanan: <span className="font-semibold text-foreground">{orderMeta.label}</span>.
            Resi akan muncul setelah paket diserahkan ke kurir.
          </p>
        </div>
      ) : null}

      <ol className="grid grid-cols-1 gap-1 min-[480px]:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-4">
        {SHIPPING_STEPS.map((step, index) => {
          const meta = statusMeta(step)
          const done = stepIndex >= 0 && index <= stepIndex
          const current = stepIndex === index

          return (
            <li
              key={step}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1.5",
                current ? "bg-primary/10" : "bg-transparent",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  current
                    ? "bg-primary"
                    : done
                      ? "bg-muted-foreground/50"
                      : "bg-border",
                )}
              />
              <p
                className={cn(
                  "truncate text-[11px] font-medium leading-tight",
                  current ? "text-foreground" : "text-muted-foreground",
                )}
                title={meta.label}
              >
                {meta.label}
              </p>
            </li>
          )
        })}
      </ol>

      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-xs text-muted-foreground">Kurir</dt>
          <dd className="text-right font-semibold">
            {track.carrier_name?.trim() || (hasWaybill ? "J&T Cargo" : "Belum ditetapkan")}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-xs text-muted-foreground">Nomor resi</dt>
          <dd className="text-right">
            {hasWaybill ? (
              <span className="inline-flex flex-wrap items-center justify-end gap-2">
                <span className="font-mono text-xs font-semibold">{track.waybill_number}</span>
                {onCopyWaybill ? (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-primary hover:underline"
                    onClick={() => onCopyWaybill(track.waybill_number || "")}
                  >
                    Salin
                  </button>
                ) : null}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Belum ada</span>
            )}
          </dd>
        </div>
        {track.last_status_at ? (
          <div className="flex justify-between gap-3">
            <dt className="text-xs text-muted-foreground">Update terakhir</dt>
            <dd className="text-right text-xs">{formatDateTime(track.last_status_at)}</dd>
          </div>
        ) : null}
        {track.status_raw ? (
          <div>
            <dt className="text-xs text-muted-foreground">Keterangan kurir</dt>
            <dd className="mt-1 text-xs text-muted-foreground">{track.status_raw}</dd>
          </div>
        ) : null}
      </dl>

      {track.tracking_url ? (
        <a
          href={track.tracking_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Buka tracking kurir
          <Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
        </a>
      ) : null}

      <p className="text-[11px] leading-5 text-muted-foreground">
        {hasWaybill
          ? jntEnabled
            ? "Status di atas mengikuti catatan pengiriman toko; refresh J&T memperbarui dari kurir bila tersedia."
            : "Resi tersimpan di sistem. Integrasi J&T belum aktif — status kurir live belum ditarik otomatis."
          : isCancelled
            ? "Pengiriman dibatalkan; tidak ada resi aktif untuk dilacak."
            : isReturned
              ? "Paket dikembalikan; detail retur akan mengikuti pembaruan dari toko."
              : isUnknown
                ? "Status kurir belum dikenali. Informasi akan diperbarui saat data baru tersedia."
                : "Belum ada resi. Status menampilkan tahap pengiriman dari pesanan. Resi akan muncul setelah diterbitkan."}
      </p>
    </div>
  )
}
