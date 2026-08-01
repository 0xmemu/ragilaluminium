import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { RowActions, rowActionTextClass } from "@/components/admin/row-actions"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { FlashSalePeriod, Pagination as PaginationData } from "@/types"

interface FlashProduct {
  id: number
  parent_sku: string
  name: string
  status: string
  image?: string | null
  min_price: number | null
  compare_price: number | null
  discount_percent: number | null
  flash_sale: boolean
  homepage_popular: boolean
  auto_banner_eligible: boolean
  updated_at: string | null
  href: string
  edit_href: string
  enable_url: string
  disable_url: string
  public_href: string
}

interface Summary {
  active_count: number
  inactive_count: number
  auto_promotions_enabled: boolean
  auto_candidate_count: number
  bannersHref: string
  period_status: FlashSalePeriod["status"]
  period_live: boolean
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function periodStatusLabel(status: FlashSalePeriod["status"]): string {
  switch (status) {
    case "live":
      return "Berlangsung"
    case "scheduled":
      return "Terjadwal"
    case "ended":
      return "Berakhir"
    default:
      return "Nonaktif"
  }
}

function PeriodForm({
  period,
  updateUrl,
}: {
  period: FlashSalePeriod
  updateUrl: string
}) {
  const form = useForm({
    enabled: period.enabled,
    starts_at: toDatetimeLocal(period.starts_at),
    ends_at: toDatetimeLocal(period.ends_at),
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.transform((data) => ({
        enabled: data.enabled,
        starts_at: data.starts_at || null,
        ends_at: data.ends_at || null,
      }))
    form.put(updateUrl, { preserveScroll: true })
  }

  return (
    <form
      onSubmit={submit}
      className="mb-6 space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">Periode Flash Sale</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Jangka waktu kampanye global. Produk tetap ditandai per SKU; storefront hanya menampilkan Flash Sale saat periode live.
          </p>
        </div>
        <StatusBadge status={period.live ? "active" : "inactive"} label={periodStatusLabel(period.status)} />
      </div>

      <FormErrorSummary errors={form.errors} />

      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          className="size-4 rounded border-border"
          checked={form.data.enabled}
          onChange={(event) => form.setData("enabled", event.target.checked)}
        />
        Aktifkan periode Flash Sale
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="starts_at" label="Mulai" error={form.errors.starts_at}>
          <Input
            id="starts_at"
            type="datetime-local"
            value={form.data.starts_at}
            onChange={(event) => form.setData("starts_at", event.target.value)}
          />
        </Field>
        <Field id="ends_at" label="Selesai" error={form.errors.ends_at}>
          <Input
            id="ends_at"
            type="datetime-local"
            value={form.data.ends_at}
            onChange={(event) => form.setData("ends_at", event.target.value)}
          />
        </Field>
      </div>

      {period.range_label ? (
        <p className="text-sm text-muted-foreground">{period.range_label}</p>
      ) : null}

      <Button type="submit" disabled={form.processing}>
        {form.processing ? "Menyimpan..." : "Simpan periode"}
      </Button>
    </form>
  )
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function ProductActions({
  product,
  busyId,
  setBusyId,
}: {
  product: FlashProduct
  busyId: number | null
  setBusyId: (id: number | null) => void
}) {
  const busy = busyId === product.id

  function enable() {
    setBusyId(product.id)
    router.post(product.enable_url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
  }

  function disable() {
    setBusyId(product.id)
    router.post(product.disable_url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
  }

  return (
    <RowActions>
      <Button asChild variant="secondary" size="xs">
        <Link href={product.edit_href}>Edit</Link>
      </Button>
      {product.flash_sale ? (
        <ConfirmAction
          trigger={
            <button type="button" className={cn(rowActionTextClass, "text-destructive")} disabled={busy}>
              Nonaktifkan
            </button>
          }
          title="Nonaktifkan Flash Sale?"
          description="Label Flash Sale hilang di kartu produk dan listing /promo."
          confirmLabel="Nonaktifkan"
          processing={busy}
          onConfirm={disable}
        />
      ) : (
        <Button size="xs" disabled={busy} onClick={enable}>
          Aktifkan
        </Button>
      )}
    </RowActions>
  )
}

export default function FlashSaleIndex({
  title,
  description,
  viewMode,
  searchQuery,
  activeStatus,
  products,
  pagination,
  createHref,
  summary,
  period,
  periodUpdateUrl,
}: {
  title: string
  description: string
  viewMode: "list" | "grid"
  searchQuery: string
  activeStatus: string
  products: FlashProduct[]
  pagination: PaginationData
  createHref: string
  summary: Summary
  period: FlashSalePeriod
  periodUpdateUrl: string
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
      if (key === "status" && value === "active") return
      if (key === "q" && !value.trim()) return
      next[key] = value
    })
    router.get("/admin/flash-sale", next, { preserveState: true, replace: true })
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <Button asChild>
          <Link href={createHref}>
            <Icon name="plus" className="size-4" aria-hidden="true" />
            Tambah Flash Sale
          </Link>
        </Button>
      }
    >
      <Head title={`${title} | Admin`} />

      <PeriodForm period={period} updateUrl={periodUpdateUrl} />

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">Periode</p>
          <p className="mt-1 text-lg font-bold">{periodStatusLabel(summary.period_status)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.period_live ? "Live di storefront" : "Tidak tampil di storefront"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">Produk aktif</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{summary.active_count}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">Banner otomatis</p>
          <p className="mt-1 text-sm font-semibold">
            {summary.auto_promotions_enabled ? "On" : "Off"} · {summary.auto_candidate_count} kandidat
          </p>
          <Link href={summary.bannersHref} className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">
            Kelola di Promo Toko
          </Link>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form
          className="min-w-[16rem] flex-1"
          onSubmit={(event) => {
            event.preventDefault()
            visit({ q: q.trim() || undefined })
          }}
        >
          <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="flash-q">
            Cari produk
          </label>
          <Input
            id="flash-q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Nama atau SKU"
          />
        </form>
        <div className="w-40">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="flash-status">
            Status
          </label>
          <Select
            id="flash-status"
            value={activeStatus}
            onChange={(event) => visit({ status: event.target.value })}
          >
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
            <option value="all">Semua</option>
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

      {!products.length ? (
        <EmptyState
          title="Belum ada Flash Sale"
          description="Tambah produk ke Flash Sale lewat atribut promo_flash_sale (dan opsional harga coret)."
          action={
            <Button asChild>
              <Link href={createHref}>Tambah Flash Sale</Link>
            </Button>
          }
        />
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
              <div className="aspect-square bg-muted">
                {product.image ? (
                  <img src={product.image} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <Icon name="image" className="size-6" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={product.flash_sale ? "active" : "inactive"} />
                  {product.discount_percent ? (
                    <span className="text-xs font-bold text-primary">-{product.discount_percent}%</span>
                  ) : null}
                </div>
                <Link href={product.href} className="line-clamp-2 text-sm font-semibold hover:text-primary">
                  {product.name}
                </Link>
                <p className="font-mono text-[11px] text-muted-foreground">{product.parent_sku}</p>
                <p className="text-sm font-semibold tabular-nums">
                  {product.min_price !== null ? formatCurrency(product.min_price) : "-"}
                  {product.compare_price ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground line-through">
                      {formatCurrency(product.compare_price)}
                    </span>
                  ) : null}
                </p>
                <p className="text-[11px] text-muted-foreground">Diperbarui {formatDateTime(product.updated_at)}</p>
                <ProductActions product={product} busyId={busyId} setBusyId={setBusyId} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-tight text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-semibold">Produk</th>
                <th className="px-3 py-3 font-semibold">Harga</th>
                <th className="px-3 py-3 font-semibold">Diskon</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Diperbarui</th>
                <th className="px-3 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-12 shrink-0 overflow-hidden rounded bg-muted">
                        {product.image ? (
                          <img src={product.image} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground">
                            <Icon name="image" className="size-4" aria-hidden="true" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link href={product.href} className="line-clamp-2 text-sm font-semibold hover:text-primary">
                          {product.name}
                        </Link>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{product.parent_sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    <div className="font-semibold">
                      {product.min_price !== null ? formatCurrency(product.min_price) : "-"}
                    </div>
                    {product.compare_price ? (
                      <div className="text-xs text-muted-foreground line-through">
                        {formatCurrency(product.compare_price)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 font-semibold tabular-nums">
                    {product.discount_percent ? `-${product.discount_percent}%` : "-"}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={product.flash_sale ? "active" : "inactive"} />
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{formatDateTime(product.updated_at)}</td>
                  <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
                    <ProductActions product={product} busyId={busyId} setBusyId={setBusyId} />
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
