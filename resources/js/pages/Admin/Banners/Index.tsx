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
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"
import type { Pagination as PaginationData } from "@/types"

interface BannerCard {
  id: number
  title?: string | null
  image_url: string
  link_url?: string | null
  sort_order: number
  published: boolean
  created_at: string | null
  updated_at: string | null
  edit_href: string
  publish_url: string
  unpublish_url: string
}

interface AutoPromotionsProps {
  enabled: boolean
  max_slides: number
  candidate_count: number
  updateUrl: string
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

function BannerActions({
  banner,
  busyId,
  setBusyId,
}: {
  banner: BannerCard
  busyId: number | null
  setBusyId: (id: number | null) => void
}) {
  const busy = busyId === banner.id

  function publish() {
    setBusyId(banner.id)
    router.post(banner.publish_url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
  }

  function unpublish() {
    setBusyId(banner.id)
    router.post(banner.unpublish_url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
  }

  return (
    <RowActions>
      <Button asChild variant="secondary" size="xs">
        <Link href={banner.edit_href}>Edit</Link>
      </Button>
      {banner.published ? (
        <ConfirmAction
          trigger={
            <button type="button" className={cn(rowActionTextClass, "text-destructive")} disabled={busy}>
              Nonaktifkan
            </button>
          }
          title="Nonaktifkan promo?"
          description="Slide tidak akan tampil di beranda publik."
          confirmLabel="Nonaktifkan"
          processing={busy}
          onConfirm={unpublish}
        />
      ) : (
        <Button size="xs" disabled={busy} onClick={publish}>
          Aktifkan
        </Button>
      )}
    </RowActions>
  )
}

export default function BannersIndex({
  title,
  description,
  viewMode,
  searchQuery,
  activeStatus,
  banners,
  pagination,
  createHref,
  autoPromotions,
}: {
  title: string
  description: string
  viewMode: "list" | "grid"
  searchQuery: string
  activeStatus: string
  banners: BannerCard[]
  pagination: PaginationData
  createHref: string
  autoPromotions: AutoPromotionsProps
}) {
  const [q, setQ] = React.useState(searchQuery)
  const [busyId, setBusyId] = React.useState<number | null>(null)

  const autoForm = useForm({
    enabled: autoPromotions.enabled,
    max_slides: autoPromotions.max_slides,
  })

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
      if (key === "view" && value === "grid") return
      if (key === "q" && !value.trim()) return
      next[key] = value
    })
    router.get("/admin/banners", next, { preserveState: true, replace: true })
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <Button asChild>
          <Link href={createHref}>
            <Icon name="plus" className="size-4" aria-hidden="true" />
            Tambah Promo
          </Link>
        </Button>
      }
    >
      <Head title={`${title} | Admin`} />

      <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Mode banner promosi</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              {autoForm.data.enabled
                ? "Mode otomatis aktif. Produk dengan harga coret atau Flash Sale dapat masuk setelah banner manual."
                : "Mode manual aktif. Hanya banner manual yang dipublish yang tampil setelah slide pembuka brand."}
            </p>
          </div>
          <StatusBadge status={autoForm.data.enabled ? "active" : "inactive"} />
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            autoForm.put(autoPromotions.updateUrl, { preserveScroll: true })
          }}
          className="mt-4 grid gap-4 md:grid-cols-[1fr_10rem_auto] md:items-end"
        >
          <FormErrorSummary errors={autoForm.errors} className="md:col-span-3" />
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={autoForm.data.enabled}
              onChange={(event) => autoForm.setData("enabled", event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Gunakan banner otomatis dari produk
          </label>
          <Field id="auto-max-slides" label="Maks. slide" error={autoForm.errors.max_slides}>
            <Input
              type="number"
              min={1}
              max={8}
              value={autoForm.data.max_slides}
              onChange={(event) => autoForm.setData("max_slides", Number(event.target.value))}
            />
          </Field>
          <Button type="submit" disabled={autoForm.processing}>
            {autoForm.processing ? "Menyimpan..." : "Simpan"}
          </Button>
          <p className="text-xs text-muted-foreground md:col-span-3">
            Kandidat produk:{" "}
            <span className="font-semibold text-foreground">{autoPromotions.candidate_count}</span>
          </p>
          <p className="text-xs leading-5 text-muted-foreground md:col-span-3">
            Rekomendasi desain banner: <span className="font-semibold text-foreground">1024 × 426 px</span>
            {" "}(rasio sekitar 2,4:1). Tampilan publik melakukan crop responsif.
          </p>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <form
            className="min-w-0 flex-1"
            onSubmit={(event) => {
              event.preventDefault()
              visit({ q })
            }}
          >
            <label className="text-[11px] font-semibold uppercase tracking-tight text-muted-foreground">
              Cari promo
            </label>
            <div className="mt-1.5 flex gap-2">
              <Input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Judul atau link"
              />
              <Button type="submit" variant="secondary">
                Cari
              </Button>
            </div>
          </form>
          <div className="w-full sm:w-48">
            <label className="text-[11px] font-semibold uppercase tracking-tight text-muted-foreground">
              Status
            </label>
            <Select
              className="mt-1.5"
              value={activeStatus}
              onChange={(event) => visit({ status: event.target.value })}
            >
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </Select>
          </div>
          <div className="flex gap-1 rounded-md border border-border p-1">
            <button
              type="button"
              onClick={() => visit({ view: "grid" })}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded px-3 text-xs font-semibold",
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon name="layout-grid" className="size-3.5" aria-hidden="true" />
              Grid
            </button>
            <button
              type="button"
              onClick={() => visit({ view: "list" })}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded px-3 text-xs font-semibold",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon name="menu" className="size-3.5" aria-hidden="true" />
              List
            </button>
          </div>
        </div>
      </section>

      {!banners.length ? (
        <EmptyState
          className="mt-6"
          title="Belum ada promo manual"
          description={
            autoForm.data.enabled
              ? "Tambah slide promo beranda, atau matikan mode otomatis untuk menyiapkan mode manual penuh."
              : "Mode manual aktif. Tambahkan dan publish banner agar tampil setelah slide pembuka brand."
          }
          action={
            <Button asChild>
              <Link href={createHref}>Tambah Promo</Link>
            </Button>
          }
        />
      ) : viewMode === "list" ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
          <table className="min-w-full text-left">
            <thead className="border-b border-border bg-surface-muted/50 text-[11px] font-semibold uppercase tracking-tight text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Promo</th>
                <th className="px-3 py-3">Urutan</th>
                <th className="px-3 py-3">Diperbarui</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((banner) => (
                <tr key={banner.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-14 shrink-0 overflow-hidden rounded bg-muted">
                        <ResponsiveImage
                          src={banner.image_url}
                          alt={banner.title ?? `Promo #${banner.id}`}
                          wrapperClassName="size-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {banner.title ?? `Promo #${banner.id}`}
                        </p>
                        <p className="mt-0.5 break-all text-xs text-muted-foreground">
                          {banner.link_url || "Tanpa link"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="tabular-nums px-3 py-3 text-sm">{banner.sort_order}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {formatDateTime(banner.updated_at)}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={banner.published ? "active" : "inactive"} />
                  </td>
                  <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
                    <BannerActions banner={banner} busyId={busyId} setBusyId={setBusyId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {banners.map((banner) => (
            <article
              key={banner.id}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-soft"
            >
              <ResponsiveImage
                src={banner.image_url}
                alt={banner.title ?? `Promo #${banner.id}`}
                wrapperClassName="aspect-[1024/426]"
              />
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-bold">{banner.title ?? `Promo #${banner.id}`}</h2>
                  <StatusBadge status={banner.published ? "active" : "inactive"} />
                </div>
                <p className="break-all text-xs text-muted-foreground">
                  {banner.link_url || "Tanpa link"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Urutan {banner.sort_order} · Update {formatDateTime(banner.updated_at)}
                </p>
                <BannerActions banner={banner} busyId={busyId} setBusyId={setBusyId} />
              </div>
            </article>
          ))}
        </div>
      )}

      {pagination.last_page > 1 ? (
        <div className="mt-6">
          <Pagination pagination={pagination} />
        </div>
      ) : null}
    </AdminLayout>
  )
}
