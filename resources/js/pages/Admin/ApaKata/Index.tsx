import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { RowActions, RowActionsMenu } from "@/components/admin/row-actions"
import { DropdownMenuItem } from "@/components/admin/ui/dropdown-menu"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { ReorderActionButton } from "@/components/admin/reorder-action-button"
import { ReorderDragHandle } from "@/components/admin/reorder-drag-handle"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Field } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { humanize } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { useRowDragSort } from "@/hooks/use-row-drag-sort"

interface ApaKataRow {
  id: number
  no: number
  customer_name: string
  message?: string | null
  rating?: number | null
  source: string
  source_label?: string
  location?: string | null
  product?: string | null
  image_url?: string | null
  sort_order?: number
  published: boolean
  created_at?: string | null
  edit_href: string
  publish_url: string
  unpublish_url: string
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

function PublishActions({
  published,
  editHref,
  publishUrl,
  unpublishUrl,
  busy,
  onBusy,
}: {
  published: boolean
  editHref: string
  publishUrl?: string | null
  unpublishUrl?: string | null
  busy: boolean
  onBusy: (value: boolean) => void
}) {
  return (
    <RowActions>
      <Button asChild variant="secondary" size="xs">
        <Link href={editHref}>Edit</Link>
      </Button>
      <RowActionsMenu>
        {published ? (
          <ConfirmAction
            trigger={
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                disabled={busy}
              >
                Sembunyikan
              </button>
            }
            title="Sembunyikan screenshot?"
            description="Item tidak akan tampil di storefront."
            confirmLabel="Sembunyikan"
            processing={busy}
            onConfirm={() => {
              if (!unpublishUrl) return
              onBusy(true)
              router.post(unpublishUrl, {}, { preserveScroll: true, onFinish: () => onBusy(false) })
            }}
          />
        ) : (
          <DropdownMenuItem asChild>
            <button
              type="button"
              className="w-full text-left"
              disabled={busy || !publishUrl}
              onClick={() => {
                if (!publishUrl) return
                onBusy(true)
                router.post(publishUrl, {}, { preserveScroll: true, onFinish: () => onBusy(false) })
              }}
            >
              Publikasikan
            </button>
          </DropdownMenuItem>
        )}
      </RowActionsMenu>
    </RowActions>
  )
}

export default function ApaKataIndex({
  title,
  description,
  filters,
  publishedOptions,
  createHref,
  createLabel,
  rows = [],
  indexRoute = "admin.apa-kata-pelanggan.index",
  pageMeta = null,
  metaUrl = null,
  metaHint = null,
  previewUrl = null,
  reorderUrl = null,
  canReorder = false,
}: {
  title: string
  description: string
  filters: { q: string; published: string }
  publishedOptions: Array<{ value: string; label: string }>
  createHref: string
  createLabel: string
  rows?: ApaKataRow[]
  indexRoute?: string
  pageMeta?: { title: string; heading: string; subtitle: string; published: boolean } | null
  metaUrl?: string | null
  metaHint?: string | null
  previewUrl?: string | null
  reorderUrl?: string | null
  canReorder?: boolean
}) {
  const [q, setQ] = React.useState(filters.q)
  const [published, setPublished] = React.useState(filters.published)
  const [busyId, setBusyId] = React.useState<number | string | null>(null)
  const [reorderMode, setReorderMode] = React.useState(false)
  const [orderedRows, setOrderedRows] = React.useState<ApaKataRow[]>(rows)
  // Geser-urut hanya sahih saat daftar memuat seluruh baris: payload simpan hanya
  // berisi baris yang tampil, jadi daftar tersaring menulis sort_order parsial.
  // Pencarian tidak dikunci karena tombol Urutkan membersihkannya sendiri.
  const listTersaring = filters.q.trim() !== "" || filters.published !== ""
  const filterKunci = filters.published !== ""
  const metaForm = useForm({
    title: pageMeta?.title ?? "",
    heading: pageMeta?.heading ?? "",
    subtitle: pageMeta?.subtitle ?? "",
    published: pageMeta?.published ?? true,
  })
  const reorderForm = useForm({
    rows: rows.map((row, index) => ({
      id: row.id,
      sort_order: row.sort_order ?? index,
    })),
  })

  React.useEffect(() => {
    if (!pageMeta) return
    metaForm.setData({
      title: pageMeta.title,
      heading: pageMeta.heading,
      subtitle: pageMeta.subtitle,
      published: pageMeta.published,
    })
    // `useForm` returns a new facade on every render; CMS metadata is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageMeta])

  React.useEffect(() => {
    const next = rows
    // Keep the reorder editor aligned with the loaded rows.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderedRows(next)
    // Data dan defaults dipindah bersama: `isDirty` membandingkan data dengan
    // defaults, jadi keduanya harus berisi snapshot server yang sama.
    reorderForm.setData({
      rows: next.map((row, index) => ({ id: row.id, sort_order: index })),
    })
    reorderForm.setDefaults({
      rows: next.map((row, index) => ({ id: row.id, sort_order: index })),
    })
    // Mode urut tidak direset di sini: menyalakan mode urut membersihkan
    // pencarian dan itu memuat ulang rows, sehingga mode urut akan langsung
    // mati sendiri. Reset terjadi lewat onSuccess simpan dan tombol Urungkan.
    // `useForm` returns a new facade on every render; rows define the editor snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  function apply(next?: Partial<{ q: string; published: string }>) {
    const params: Record<string, string> = {
      q: next?.q ?? q,
      published: next?.published ?? published,
    }
    router.get(routeUrl(indexRoute), params, { preserveState: true, preserveScroll: true })
  }

  function reorderRows(from: number, to: number) {
    if (from === to) return
    const next = [...orderedRows]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    const numbered = next.map((row, i) => ({ ...row, no: i + 1, sort_order: i }))
    setOrderedRows(numbered)
    reorderForm.setData(
      "rows",
      numbered.map((row, i) => ({ id: row.id, sort_order: i })),
    )
  }

  function saveReorder() {
    reorderForm.put(reorderUrl as string, {
      preserveScroll: true,
      onSuccess: () => setReorderMode(false),
    })
  }

  /** Batalkan mode urut: kembalikan urutan ke snapshot server lalu keluar. */
  function cancelReorder() {
    setOrderedRows(rows)
    reorderForm.setData({
      rows: rows.map((row, index) => ({ id: row.id, sort_order: index })),
    })
    reorderForm.setDefaults({
      rows: rows.map((row, index) => ({ id: row.id, sort_order: index })),
    })
    setReorderMode(false)
  }

  // Kolom ikon tarik hanya dirender saat mode Urutkan aktif dan daftar tidak tersaring.
  const dragAktif = reorderMode && !listTersaring

  const dnd = useRowDragSort({
    enabled: dragAktif,
    count: orderedRows.length,
    onReorder: reorderRows,
  })

  const displayRows = reorderMode || canReorder ? orderedRows : rows

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {previewUrl ? (
            <Button asChild variant="secondary">
              <a href={previewUrl} target="_blank" rel="noreferrer">
                Lihat halaman publik
              </a>
            </Button>
          ) : null}
          {canReorder && reorderUrl ? (
            /* Satu tombol yang berubah peran mengikuti keadaan (kontrak owner 2026-09-20):
               Urutkan -> Urungkan saat mode aktif -> Simpan urutan begitu ada urutan
               yang benar-benar digeser. */
            <ReorderActionButton
              active={reorderMode}
              dirty={reorderForm.isDirty}
              processing={reorderForm.processing}
              disabled={!orderedRows.length || filterKunci}
              disabledReason="Kosongkan filter status dulu supaya tombol Urutkan bisa dipakai."
              onToggle={() => {
                setReorderMode(true)
                // Pencarian dibersihkan sekaligus supaya urutan bisa diubah
                // (kontrak owner 2026-09-20).
                if (filters.q) {
                  setQ("")
                  apply({ q: "" })
                }
              }}
              onCancel={cancelReorder}
              onSave={saveReorder}
            />
          ) : null}
          {!reorderMode ? (
            <Button asChild>
              <Link href={createHref}>
                <Icon name="plus" className="size-4" aria-hidden="true" />
                {createLabel}
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      {pageMeta && metaUrl ? (
        <details className="group mb-6 rounded-lg border border-border bg-card shadow-sm">
          <summary className="flex cursor-pointer items-center justify-between p-4 sm:p-5">
            <div>
              <p className="text-sm font-bold">Pengaturan tampilan (CMS)</p>
              <p className="text-xs text-muted-foreground">{metaHint ?? "Meta halaman"}</p>
            </div>
            <Icon name="caret-down" className="size-4 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t border-border p-5 sm:p-6">
          <form
  id="apk-meta-form"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              metaForm.put(metaUrl)
            }}
          >
            <Field id="apk-title" label="Judul CMS">
              <Input value={metaForm.data.title} onChange={(event) => metaForm.setData("title", event.target.value)} />
            </Field>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold sm:pt-7">
              <input
                type="checkbox"
                checked={metaForm.data.published}
                onChange={(event) => metaForm.setData("published", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Terbitkan halaman
            </label>
            <Field id="apk-heading" label="Judul hero" className="sm:col-span-2">
              <Input value={metaForm.data.heading} onChange={(event) => metaForm.setData("heading", event.target.value)} />
            </Field>
            <Field id="apk-subtitle" label="Subjudul" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={metaForm.data.subtitle}
                onChange={(event) => metaForm.setData("subtitle", event.target.value)}
              />
            </Field>
            {/* Tombol simpan duduk di section ini supaya jelas ia menyimpan meta halaman,
                bukan daftar item di bawahnya. */}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" disabled={metaForm.processing}>
                {metaForm.processing ? "Menyimpan..." : "Simpan meta"}
              </Button>
            </div>
          </form>
          </div>
        </details>
      ) : null}

      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: () => apply({ q }),
          placeholder: "Cari nama atau sumber Shopee/WhatsApp",
        }}

        className="mb-4"
      >
        <Select
          value={published}
          onChange={(event) => {
            const value = event.target.value
            setPublished(value)
            apply({ published: value })
          }}
          className="w-40"
          disabled={reorderMode}
        >
          {publishedOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </ListToolbar>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
        {displayRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-tight text-muted-foreground">
                <tr>
                  {dragAktif ? <th className="w-12 px-3 py-3" aria-label="Seret" /> : null}
                  <th className="px-3 py-3 font-semibold">No</th>
                  <th className="px-3 py-3 font-semibold">Pelanggan</th>
                  <th className="px-3 py-3 font-semibold">Sumber</th>
                  <th className="px-3 py-3 font-semibold">Screenshot</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Tanggal</th>
                  <th className="px-3 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, index) => (
                  <tr key={row.id} className={cn("border-t border-border align-top", dnd.draggingIndex === index && "opacity-40")} {...(dragAktif ? dnd.rowProps(index) : {})}>
                    {/* Ikon tarik hanya ada saat mode Urutkan aktif, jadi kolomnya
                        tidak dirender di luar mode itu (kontrak owner 2026-09-20, direvisi). */}
                    {dragAktif ? (
                      <td className="w-12 px-3 py-3">
                        <ReorderDragHandle enabled />
                      </td>
                    ) : null}
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">{row.no}</td>
                    <td className="px-3 py-3">
                      <Link href={row.edit_href} className="font-semibold hover:text-primary hover:underline">
                        {row.customer_name}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {row.source_label ?? humanize(row.source)}
                        {row.location ? ` · ${row.location}` : ""}
                      </p>
                      {row.product ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{row.product}</p>
                      ) : null}
                      {!row.image_url ? (
                        <p className="mt-0.5 text-[11px] font-semibold text-destructive">Belum ada screenshot</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {row.source_label ?? humanize(row.source)}
                    </td>
                    <td className="px-3 py-3">
                      {row.image_url ? (
                        <img
                          src={row.image_url}
                          alt={`Screenshot ${row.customer_name}`}
                          className="h-20 w-16 rounded-md border border-border object-cover"
                        />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge
                        status={row.published ? "active" : "inactive"}
                        label={row.published ? "Published" : "Draft"}
                      />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{formatDateTime(row.created_at)}</td>
                    <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
                      {reorderMode ? (
                        <span className="text-xs text-muted-foreground">Mode Urutkan</span>
                      ) : (
                        <PublishActions
                          published={row.published}
                          editHref={row.edit_href}
                          publishUrl={row.publish_url}
                          unpublishUrl={row.unpublish_url}
                          busy={busyId === row.id}
                          onBusy={(value) => setBusyId(value ? row.id : null)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Belum ada screenshot"
            description="Tambahkan screenshot percakapan Shopee atau WhatsApp (bukan ulasan transaksi website)."
            className="border-0"
          />
        )}
      </section>
    </AdminLayout>
  )
}
