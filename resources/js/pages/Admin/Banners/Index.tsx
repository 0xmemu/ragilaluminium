import { Head, Link, router, useForm } from "@inertiajs/react"
import { navigateFilter } from "@/lib/filter-url"
import { routeUrl } from "@/lib/routes"
import * as React from "react"

import { ReorderDragHandle } from "@/components/admin/reorder-drag-handle"
import { RowActions, RowActionsMenu } from "@/components/admin/row-actions"
import { DropdownMenuItem } from "@/components/admin/ui/dropdown-menu"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Pagination } from "@/components/admin/ui/pagination"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { useAutoRefreshPause } from "@/lib/admin-auto-refresh"
import { useRowDragSort } from "@/hooks/use-row-drag-sort"
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
  destroy_url: string
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
      <RowActionsMenu>
        {banner.published ? (
          <ConfirmAction
            trigger={
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                disabled={busy}
              >
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
          <DropdownMenuItem asChild>
            <button
              type="button"
              className="w-full text-left"
              disabled={busy}
              onClick={publish}
            >
              Aktifkan
            </button>
          </DropdownMenuItem>
        )}
        <ConfirmAction
          trigger={
            <button
              type="button"
              className="w-full px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
              disabled={busy}
            >
              Hapus
            </button>
          }
          title="Hapus promo toko?"
          description="Banner dihapus permanen beserta file media terkait di penyimpanan."
          confirmLabel="Hapus permanen"
          processing={busy}
          onConfirm={() => {
            setBusyId(banner.id)
            router.delete(banner.destroy_url, { preserveScroll: true, onFinish: () => setBusyId(null) })
          }}
        />
      </RowActionsMenu>
    </RowActions>
  )
}

export default function BannersIndex({
  title,
  backUrl,
  description,
  viewMode,
  searchQuery,
  activeStatus,
  banners,
  pagination,
  createHref,
}: {
  title: string
  /** Tujuan tombol Kembali, diisi halaman induk (Promo Toko). */
  backUrl?: string | null
  description: string
  viewMode: "list" | "grid"
  searchQuery: string
  activeStatus: string
  banners: BannerCard[]
  pagination: PaginationData
  createHref: string
}) {
  const [q, setQ] = React.useState(searchQuery)
  const [busyId, setBusyId] = React.useState<number | null>(null)

  // Mode Urutkan (owner 2026-09-29): geser urutan lewat pegangan di baris,
  // angka di form tambah/edit sudah dihapus. Hanya di tampilan List; daftar
  // tersaring tidak bisa digeser karena posisi target tidak mewakili global.
  const [reorderMode, setReorderMode] = React.useState(false)
  // Selama mode Urutkan, muat ulang otomatis dijeda agar geseran tidak terusik.
  useAutoRefreshPause(reorderMode)
  // Urutan lokal dipakai HANYA selama mode Urutkan; di luar itu daftar selalu
  // mengikuti props server supaya filter/pindah halaman tidak menampilkan data basi.
  const [rows, setRows] = React.useState(banners)
  const canReorder = reorderMode && q === "" && activeStatus === "all" && viewMode === "list"
  const daftar = canReorder ? rows : banners
  const urutanDasar = ((pagination.current_page ?? 1) - 1) * (pagination.per_page ?? 20)
  const urutanForm = useForm<{ rows: Array<{ id: number; sort_order: number }> }>({
    rows: [],
  })

  function geser(from: number, to: number) {
    if (from === to) return
    setRows((current) => {
      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const dnd = useRowDragSort({
    enabled: canReorder,
    count: daftar.length,
    onReorder: geser,
  })

  function mulaiUrutkan() {
    if (viewMode !== "list") {
      visit({ view: "list" })
    }
    setRows(banners)
    setReorderMode(true)
  }

  function batalkanUrutkan() {
    setRows(banners)
    urutanForm.setData("rows", [])
    urutanForm.setDefaults("rows", [])
    setReorderMode(false)
  }

  function simpanUrutan() {
    urutanForm.setData(
      "rows",
      rows.map((row, index) => ({ id: row.id, sort_order: urutanDasar + index + 1 })),
    )
    urutanForm.put(routeUrl("admin.banners.reorder"), {
      preserveScroll: true,
      onSuccess: () => setReorderMode(false),
    })
  }

  function visit(params: Record<string, string | undefined>) {
    navigateFilter(
      "admin.banners.index",
      { view: viewMode, q: searchQuery, status: activeStatus },
      params,
      { defaults: { view: "grid" } },
    )
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      backUrl={backUrl}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {reorderMode ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={batalkanUrutkan}
                disabled={urutanForm.processing}
              >
                Urungkan
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={simpanUrutan}
                disabled={urutanForm.processing || !canReorder}
                title={canReorder ? undefined : "Kosongkan pencarian dan pilih Semua status untuk menyimpan urutan"}
              >
                {urutanForm.processing ? "Menyimpan..." : "Simpan urutan"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={mulaiUrutkan}
              title="Geser urutan slide di tampilan List"
            >
              <Icon name="list" className="size-3.5" aria-hidden="true" />
              Urutkan
            </Button>
          )}
          <Button asChild size="sm">
            <Link href={createHref}>
              <Icon name="plus" className="size-4" aria-hidden="true" />
              Tambah
            </Link>
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: () => visit({ q }),
          placeholder: "Judul atau link",
        }}
        actions={
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
        }
      >
        <Select
          className="w-full sm:w-48"
          value={activeStatus}
          onChange={(event) => visit({ status: event.target.value })}
          aria-label="Filter status"
        >
          <option value="all">Semua status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </Select>
      </ListToolbar>

      {reorderMode ? (
        <p className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Mode Urutkan aktif: pakai <span className="font-semibold text-foreground">ikon tarik</span> di tepi kiri baris untuk memindahkan slide, lalu tekan Simpan urutan.
          {!canReorder ? <span className="font-semibold text-foreground"> Kosongkan pencarian dan pilih Semua status agar urutan bisa digeser.</span> : null}
        </p>
      ) : null}

      {!banners.length ? (
        <EmptyState
          className="mt-6"
          title="Belum ada banner"
          description="Tambah slide promo beranda dan publish agar tampil setelah slide pembuka brand."
          action={
            <Button asChild>
              <Link href={createHref}>Tambah</Link>
            </Button>
          }
        />
      ) : viewMode === "list" ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
          <table className="min-w-full text-left">
            <thead className="border-b border-border bg-surface-muted/50 text-[11px] font-semibold tracking-tight text-muted-foreground">
              <tr>
                {canReorder ? <th className="w-12 px-2 py-3" aria-label="Seret" /> : <th className="px-3 py-3">No</th>}
                <th className="px-3 py-3">Promo</th>
                <th className="px-3 py-3">Urutan</th>
                <th className="px-3 py-3">Diperbarui</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((banner, index) => (
                <tr
                  key={banner.id}
                  className={cn(
                    "border-b border-border transition-colors hover:bg-muted/40 last:border-0",
                    dnd.draggingIndex === index && "opacity-40",
                    dnd.targetIndex === index && canReorder && "bg-muted/50",
                  )}
                  {...(canReorder ? dnd.rowProps(index) : {})}
                >
                  <td className="w-12 px-2 py-3 align-middle">
                    {canReorder ? <ReorderDragHandle enabled /> : <span className="text-xs text-muted-foreground tabular-nums">{urutanDasar + index + 1}</span>}
                  </td>
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
                  <td className="tabular-nums px-3 py-3 text-sm">{urutanDasar + index + 1}</td>
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
