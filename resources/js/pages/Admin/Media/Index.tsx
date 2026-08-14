import { Head, Link, router } from "@inertiajs/react"
import { useState } from "react"

import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { Icon } from "@/components/shared/icon"
import type { Pagination as PaginationData } from "@/types"

interface MediaRow {
  id: number
  thumb_url?: string | null
  media_kind?: string | null
  product?: string | null
  product_name?: string | null
  product_href?: string
  manage_href?: string
  variant?: string | null
  position?: number | null
  status?: string | null
  error_reason?: string | null
  visibility?: string | null
  is_main?: string | null
  actions?: Array<{ label: string; method?: string; href?: string; url?: string; confirm?: string }>
}

interface Props {
  title: string
  description: string
  filters: { status: string; visibility: string }
  statusOptions: Array<{ value: string; label: string }>
  visibilityOptions: Array<{ value: string; label: string }>
  rows: MediaRow[]
  pagination?: PaginationData | null
}

export default function MediaIndex({ title, description, filters, statusOptions, visibilityOptions, rows, pagination }: Props) {
  const [status, setStatus] = useState(filters.status)
  const [visibility, setVisibility] = useState(filters.visibility)
  const [busy, setBusy] = useState<number | null>(null)

  function applyFilter() {
    router.get(route("admin.media.index"), { status: status || undefined, visibility: visibility || undefined }, { preserveState: true, preserveScroll: true })
  }

  return (
    <AdminLayout title={title} description={description}>
      <Head title={`${title} | Admin`} />

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="w-44">
          <label className="text-xs font-semibold text-muted-foreground">Status</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {statusOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </Select>
        </div>
        <div className="w-44">
          <label className="text-xs font-semibold text-muted-foreground">Visibilitas</label>
          <Select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            {visibilityOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </Select>
        </div>
        <Button type="button" variant="secondary" onClick={applyFilter}>Terapkan</Button>
        <Button type="button" variant="ghost" onClick={() => { setStatus(""); setVisibility(""); router.get(route("admin.media.index"), {}, { preserveState: true }) }}>Reset</Button>
        <div className="ml-auto">
          <Button asChild variant="secondary">
            <Link href={route("admin.media.library")}>Media Library</Link>
          </Button>
        </div>
      </div>

      {/* Grid */}
      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Belum ada media.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rows.map((m) => (
            <div key={m.id} className="group overflow-hidden rounded-lg border border-border bg-card shadow-soft">
              <div className="relative aspect-square bg-muted overflow-hidden">
                {m.thumb_url ? (
                  m.media_kind === "video" ? (
                    <video src={m.thumb_url} muted preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    <img src={m.thumb_url} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                  )
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground/60">Tanpa gambar</div>
                )}
                {m.is_main === "ya" ? (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    <Icon name="check" className="size-3" aria-hidden="true" />Utama
                  </span>
                ) : null}
              </div>
              <div className="space-y-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{m.product_name || m.product || "Media #" + m.id}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.variant}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={m.status} />
                  <StatusBadge status={m.visibility} />
                </div>
                {m.error_reason ? (
                  <p className="line-clamp-1 text-xs text-destructive" title={m.error_reason}>{m.error_reason}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {m.manage_href ? (
                    <Button asChild variant="secondary" size="sm"><Link href={m.manage_href}>Kelola</Link></Button>
                  ) : null}
                  {m.actions?.map((a, idx) => {
                    if (a.method === "get" && a.href) {
                      return (<Button key={idx} asChild variant="ghost" size="sm"><Link href={a.href}>{a.label}</Link></Button>)
                    }
                    if (a.url && a.confirm) {
                      return (
                        <ConfirmAction
                          key={idx}
                          trigger={<button type="button" className="text-sm text-destructive">{a.label}</button>}
                          title={a.confirm}
                          description="Tindakan ini akan dijalankan pada media ini."
                          confirmLabel={a.label}
                          processing={busy === m.id}
                          onConfirm={() => {
                            setBusy(m.id)
                            const method = a.method ?? "post"
                            if (method === "delete") router.delete(a.url!, { preserveScroll: true, onFinish: () => setBusy(null) })
                            else router.post(a.url!, {}, { preserveScroll: true, onFinish: () => setBusy(null) })
                          }}
                        />
                      )
                    }
                    if (a.url) {
                      const onClick = () => {
                        const method = a.method ?? "post"
                        if (method === "delete") router.delete(a.url!)
                        else router.post(a.url!, {}, { preserveScroll: true })
                      }
                      return (<Button key={idx} type="button" variant="ghost" size="sm" onClick={onClick}>{a.label}</Button>)
                    }
                    return null
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pagination && pagination.last_page > 1 ? (
        <div className="mt-6"><Pagination pagination={pagination} /></div>
      ) : null}
    </AdminLayout>
  )
}
