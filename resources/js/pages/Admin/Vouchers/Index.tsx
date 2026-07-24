import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { RowActions, rowActionTextClass } from "@/components/admin/row-actions"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { ConfirmAction } from "@/components/ui/confirm-action"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { Select } from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Pagination as PaginationData } from "@/types"

interface VoucherCard {
  id: number
  name: string
  code: string
  discount_type: "percent" | "fixed"
  discount_value: number
  min_purchase: number
  starts_at: string | null
  ends_at: string | null
  published: boolean
  runnable: boolean
  updated_at: string | null
  edit_href: string
  publish_url: string
  unpublish_url: string
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function discountLabel(voucher: VoucherCard): string {
  if (voucher.discount_type === "percent") {
    return `${voucher.discount_value}%`
  }
  return formatCurrency(voucher.discount_value)
}

function VoucherActions({
  voucher,
  busyId,
  setBusyId,
}: {
  voucher: VoucherCard
  busyId: number | null
  setBusyId: (id: number | null) => void
}) {
  const busy = busyId === voucher.id

  function publish() {
    setBusyId(voucher.id)
    router.post(voucher.publish_url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
  }

  function unpublish() {
    setBusyId(voucher.id)
    router.post(voucher.unpublish_url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
  }

  return (
    <RowActions>
      <Button asChild variant="secondary" size="xs">
        <Link href={voucher.edit_href}>Edit</Link>
      </Button>
      {voucher.published ? (
        <ConfirmAction
          trigger={
            <button type="button" className={cn(rowActionTextClass, "text-destructive")} disabled={busy}>
              Nonaktifkan
            </button>
          }
          title="Nonaktifkan voucher?"
          description="Kode tidak bisa dipakai di checkout sampai diaktifkan lagi."
          confirmLabel="Nonaktifkan"
          processing={busy}
          onConfirm={unpublish}
        />
      ) : (
        <ConfirmAction
          trigger={
            <button type="button" className={cn(rowActionTextClass, "text-primary")} disabled={busy}>
              Aktifkan
            </button>
          }
          title="Aktifkan voucher ini?"
          description="Voucher lain yang sedang aktif akan dinonaktifkan otomatis."
          confirmLabel="Aktifkan"
          processing={busy}
          onConfirm={publish}
        />
      )}
    </RowActions>
  )
}

export default function VouchersIndex({
  title,
  description,
  viewMode,
  searchQuery,
  activeStatus,
  vouchers,
  pagination,
  createHref,
  summary,
}: {
  title: string
  description: string
  viewMode: "list" | "grid"
  searchQuery: string
  activeStatus: string
  vouchers: VoucherCard[]
  pagination: PaginationData
  createHref: string
  summary: { active_count: number; total_count: number }
}) {
  const [q, setQ] = React.useState(searchQuery)
  const [busyId, setBusyId] = React.useState<number | null>(null)

  function visit(params: Record<string, string | undefined>) {
    const next: Record<string, string> = {}
    const merged = {
      view: viewMode,
      q: searchQuery,
      status: activeStatus,
      ...params,
    }
    Object.entries(merged).forEach(([key, value]) => {
      if (!value || value === "all") return
      if (key === "view" && value === "list") return
      if (key === "q" && !value.trim()) return
      next[key] = value
    })
    router.get("/admin/vouchers", next, { preserveState: true, replace: true })
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <Button asChild>
          <Link href={createHref}>
            <Icon name="plus" className="size-4" aria-hidden="true" />
            Buat Voucher
          </Link>
        </Button>
      }
    >
      <Head title={`${title} | Admin`} />

      <section className="mb-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground shadow-sm">
        Hanya <span className="font-semibold text-foreground">1 voucher</span> yang boleh aktif sekaligus.
        Aktif sekarang: <span className="font-semibold tabular-nums text-foreground">{summary.active_count}</span> /{" "}
        {summary.total_count} total.
      </section>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form
          className="min-w-[16rem] flex-1"
          onSubmit={(event) => {
            event.preventDefault()
            visit({ q: q.trim() || undefined })
          }}
        >
          <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="voucher-q">
            Cari voucher
          </label>
          <Input
            id="voucher-q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Nama atau kode"
          />
        </form>
        <div className="w-40">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="voucher-status">
            Status
          </label>
          <Select
            id="voucher-status"
            value={activeStatus}
            onChange={(event) => visit({ status: event.target.value })}
          >
            <option value="all">Semua</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </Select>
        </div>
        <div className="flex gap-1 rounded-md border border-border p-1">
          <button
            type="button"
            className={cn(
              "inline-flex size-9 items-center justify-center rounded",
              viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
            onClick={() => visit({ view: "list" })}
            aria-label="Tampilan list"
          >
            <Icon name="menu" className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex size-9 items-center justify-center rounded",
              viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
            onClick={() => visit({ view: "grid" })}
            aria-label="Tampilan grid"
          >
            <Icon name="layout-grid" className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {!vouchers.length ? (
        <EmptyState
          title="Belum ada voucher"
          description="Buat kode voucher untuk potongan di checkout pelanggan."
          action={
            <Button asChild>
              <Link href={createHref}>Buat Voucher</Link>
            </Button>
          }
        />
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vouchers.map((voucher) => (
            <article key={voucher.id} className="rounded-lg border border-border bg-surface p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={voucher.published ? "active" : "inactive"} />
                <span className="text-sm font-bold tabular-nums text-primary">{discountLabel(voucher)}</span>
              </div>
              <h3 className="mt-2 text-sm font-semibold">{voucher.name}</h3>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{voucher.code}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {formatDateTime(voucher.starts_at)} s/d {formatDateTime(voucher.ends_at)}
              </p>
              <div className="mt-3">
                <VoucherActions voucher={voucher} busyId={busyId} setBusyId={setBusyId} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-tight text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-semibold">Nama Voucher</th>
                <th className="px-3 py-3 font-semibold">Waktu</th>
                <th className="px-3 py-3 font-semibold">Diskon</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((voucher) => (
                <tr key={voucher.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-3">
                    <p className="font-semibold">{voucher.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{voucher.code}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    <div>{formatDateTime(voucher.starts_at)}</div>
                    <div>s/d {formatDateTime(voucher.ends_at)}</div>
                  </td>
                  <td className="px-3 py-3 font-semibold tabular-nums">{discountLabel(voucher)}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={voucher.published ? "active" : "inactive"} />
                  </td>
                  <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
                    <VoucherActions voucher={voucher} busyId={busyId} setBusyId={setBusyId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination pagination={pagination} />
    </AdminLayout>
  )
}
