import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { RowActions, RowActionsMenu } from "@/components/admin/row-actions"
import { DropdownMenuItem } from "@/components/admin/ui/dropdown-menu"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { CheckboxField, Field, FieldAction } from "@/components/admin/ui/field"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Input } from "@/components/admin/ui/input"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { navigateFilter } from "@/lib/filter-url"
import type { Pagination as PaginationData } from "@/types"

interface AnnouncementCard {
  id: number
  text: string
  href?: string | null
  starts_at?: string | null
  ends_at?: string | null
  sort_order: number
  published: boolean
  created_at: string | null
  updated_at: string | null
  edit_href: string
  publish_url: string
  unpublish_url: string
  delete_url: string
  slideHref: string
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

function AnnouncementActions({
  announcement,
  busyId,
  setBusyId,
}: {
  announcement: AnnouncementCard
  busyId: number | null
  setBusyId: (id: number | null) => void
}) {
  const busy = busyId === announcement.id

  function publish() {
    setBusyId(announcement.id)
    router.post(announcement.publish_url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
  }

  function unpublish() {
    setBusyId(announcement.id)
    router.post(announcement.unpublish_url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
  }

  function remove() {
    setBusyId(announcement.id)
    router.delete(announcement.delete_url, { preserveScroll: true, onFinish: () => setBusyId(null) })
  }

  return (
    <RowActions>
      <Button asChild variant="secondary" size="xs">
        <Link href={announcement.edit_href}>Edit</Link>
      </Button>
      <RowActionsMenu>
        {announcement.published ? (
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
            title="Nonaktifkan promo bar?"
            description="Promo tidak akan tampil di bar merah storefront."
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
          title="Hapus bar promo?"
          description="Promo akan dihapus permanen dari daftar."
          confirmLabel="Hapus"
          processing={busy}
          onConfirm={remove}
        />
      </RowActionsMenu>
    </RowActions>
  )
}

export default function AnnouncementsIndex({
  title,
  description,
  searchQuery,
  activeStatus,
  announcements,
  pagination,
  createHref,
  announcementSlide,
  slideHref,
}: {
  title: string
  description: string
  searchQuery: string
  activeStatus: string
  announcements: AnnouncementCard[]
  pagination: PaginationData
  createHref: string
  announcementSlide?: { enabled: boolean; interval: number }
  slideHref: string
}) {
  const [q, setQ] = React.useState(searchQuery)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [slideEnabled, setSlideEnabled] = React.useState(announcementSlide?.enabled ?? false)
  const [slideInterval, setSlideInterval] = React.useState(announcementSlide?.interval ?? 5)
  const [savingSlide, setSavingSlide] = React.useState(false)

  function saveSlide(event: React.FormEvent) {
    event.preventDefault()
    setSavingSlide(true)
    router.post(
      slideHref,
      { enabled: slideEnabled, interval: slideInterval },
      { preserveScroll: true, onFinish: () => setSavingSlide(false) },
    )
  }

  function visit(params: Record<string, string | undefined>) {
    navigateFilter(
      "admin.announcements.index",
      { q: searchQuery, status: activeStatus },
      params,
    )
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => router.reload()}
            className="inline-flex items-center gap-1.5"
          >
            <Icon name="refresh" className="size-3.5" aria-hidden="true" />
            <span>Muat ulang</span>
          </Button>
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

      <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-bold">Cara kerja</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          Bar merah di atas header menampilkan{" "}
          <span className="font-semibold text-foreground">satu promo teratas</span> yang berstatus aktif
          dan masih dalam periode. Urutkan lewat kolom "Urutan" (angka terkecil tampil lebih dulu).
          Saat Anda mengganti teks/link, bar muncul kembali untuk pengunjung yang sebelumnya menutupnya.
          Jika daftar ini kosong, bar otomatis menampilkan promo dari sumber lain
          (config/CMS) agar tidak pernah kosong.
        </p>
      </section>

      {/* Baris kontrol seragam: search | filter | actions */}
      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: () => visit({ q }),
          placeholder: "Teks atau link promo…",
        }}

        className="mb-6"
      >
        <Select
          className="w-40"
          value={activeStatus}
          onChange={(event) => visit({ status: event.target.value })}
          aria-label="Filter status"
        >
          <option value="all">Semua status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </Select>
      </ListToolbar>

      <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-bold">Slide bar promo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aktifkan rotasi otomatis antar beberapa bar promo aktif di header storefront.
        </p>
        <form onSubmit={saveSlide} className="mt-4 grid gap-4 content-start sm:grid-cols-[auto_10rem_auto]">
          <CheckboxField
            id="slide-enabled"
            checked={slideEnabled}
            onChange={(checked) => setSlideEnabled(checked)}
            label="Aktifkan slide"
          />
          <Field id="slide-interval" label="Interval (detik)">
            <Input
              type="number"
              min={2}
              max={30}
              value={slideInterval}
              onChange={(event) => setSlideInterval(Number(event.target.value))}
            />
          </Field>
          <FieldAction>
            <Button type="submit" variant="secondary" disabled={savingSlide}>
              {savingSlide ? "Menyimpan..." : "Simpan"}
            </Button>
          </FieldAction>
        </form>
      </section>

      {!announcements.length ? (
        <EmptyState
          className="mt-6"
          title="Belum ada bar promo"
          description="Tambahkan teks promo dan link tujuan. Item teratas yang aktif akan tampil di bar merah storefront."
          action={
            <Button asChild>
              <Link href={createHref}>Tambah</Link>
            </Button>
          }
        />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
          <table className="min-w-full text-left">
            <thead className="border-b border-border bg-surface-muted/50 text-[11px] font-semibold uppercase tracking-tight text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Promo</th>
                <th className="px-3 py-3">Periode</th>
                <th className="px-3 py-3">Urutan</th>
                <th className="px-3 py-3">Diperbarui</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {announcements.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{item.text}</p>
                      <p className="mt-0.5 break-all text-xs text-muted-foreground">
                        {item.href || "Tanpa link"}
                      </p>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                    {item.starts_at || "-"} → {item.ends_at || "-"}
                  </td>
                  <td className="tabular-nums px-3 py-3 text-sm">{item.sort_order}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                    {formatDateTime(item.updated_at)}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={item.published ? "active" : "inactive"} />
                  </td>
                  <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
                    <AnnouncementActions announcement={item} busyId={busyId} setBusyId={setBusyId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
