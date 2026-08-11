import { Link } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu"
import { routeUrl } from "@/lib/routes"

export interface ActivityLogItem {
  id: number
  event_type: string
  entity_type: string
  created_at?: string | null
  created_at_label?: string | null
  actor?: string | null
}

/**
 * Ikon/action terpisah untuk Log Aktivitas.
 * Dipisah dari Notifikasi karena tujuan & tingkat urgensi berbeda:
 * notifikasi = perlu perhatian/pembacaan; log aktivitas = jejak audit.
 * Tidak memakai badge (bukan item "belum dibaca").
 */
export function ActivityLogBell({ activityLogs = [] }: { activityLogs?: ActivityLogItem[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label="Log aktivitas"
          title="Log aktivitas"
        >
          <Icon name="history" className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,22rem)]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-foreground">Log Aktivitas</span>
          <Link
            href={routeUrl("admin.activity-logs.index")}
            className="text-xs font-medium text-primary hover:underline"
          >
            Lihat semua
          </Link>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[min(60vh,26rem)] overflow-y-auto">
          {activityLogs.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              Belum ada aktivitas.
            </p>
          ) : (
            activityLogs.slice(0, 10).map((l) => (
              <div
                key={l.id}
                className="flex w-full items-start gap-3 border-b border-border/60 px-4 py-2.5 last:border-0"
              >
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon name="history" className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">
                    {l.event_type}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {l.entity_type} · {l.actor || "Sistem"}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground/70">
                    {l.created_at_label ?? l.created_at}
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
