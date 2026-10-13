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
import { CheckboxField, Field, FieldGrid } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { humanize } from "@/lib/format"
import { navigateFilter } from "@/lib/filter-url"
import { cn } from "@/lib/utils"
import { useRowDragSort } from "@/hooks/use-row-drag-sort"
import { useReorderMode } from "@/hooks/use-reorder-mode"
import { SubmitGateButton } from "@/components/admin/ui/submit-gate-button"
import { gerbangBolehLanjut } from "@/lib/submit-gate"

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
  // Geser-urut hanya sahih saat daftar memuat seluruh baris: payload simpan hanya
  // berisi baris yang tampil, jadi daftar tersaring menulis sort_order parsial.
  // Pencarian tidak dikunci karena tombol Urutkan membersihkannya sendiri.
  const listTersaring = filters.q.trim() !== "" || filters.published !== ""
  const filterKunci = filters.published !== ""
  // Kontrak halaman pengaturan (ADR-023): bagian yang tugasnya mengubah nilai
  // yang sudah ada dibuka terkunci, seragam dengan bagian Slide bar promo di
  // halaman Bar Promo. Isian baru hidup setelah admin menekan Edit.

  const [showMeta, setShowMeta] = React.useState(false)
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
  // Mode Urutkan dikelola hook bersama; nama variabel dipertahankan supaya JSX
  // dan tombol header tidak perlu berubah.
  const {
    mode: reorderMode,
    setMode: setReorderMode,
    orderedRows,
    move: reorderRows,
    save: saveReorder,
    cancel: cancelReorder,
  } = useReorderMode({
    snapshot: rows,
    form: reorderForm,
    url: reorderUrl as string,
    buildItems: (list) => list.map((row, index) => ({ id: row.id, sort_order: index + 1 })),
    numbering: true,
    submitOptions: { preserveScroll: true },
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


  function apply(next?: Partial<{ q: string; published: string }>) {
    // Hanya kunci yang benar-benar dikirim yang menimpa keadaan saat ini.
    const dikirim: Record<string, string | undefined> = {}
    if (next?.q !== undefined) dikirim.q = next.q
    if (next?.published !== undefined) dikirim.published = next.published
    navigateFilter(indexRoute, { q, published }, dikirim, { replace: false })
  }



  /** Batalkan mode urut: kembalikan urutan ke snapshot server lalu keluar. */

  // Kolom ikon tarik hanya dirender saat mode Urutkan aktif dan daftar tidak tersaring.
  const dragAktif = reorderMode && !listTersaring

  const dnd = useRowDragSort({
    enabled: dragAktif,
    count: orderedRows.length,
    onReorder: reorderRows,
  })

  const displayRows = reorderMode || canReorder ? orderedRows : rows


  // Gerbang isi tombol simpan: kolom wajibnya mengikuti aturan
  // `required` controller, jadi frontend tidak menciptakan aturan baru.
  const gerbangMeta = {
    fields: {"title": "Judul CMS", "heading": "Judul hero"},
    requireChange: true,
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      lockInteraction={reorderMode}
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
          {pageMeta && metaUrl ? (
            <Button type="button" variant="secondary" onClick={() => setShowMeta((v) => !v)}>
              {showMeta ? "Tutup pengaturan" : "Pengaturan halaman"}
            </Button>
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

      {pageMeta && metaUrl && showMeta ? (
        <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-tight text-muted-foreground">Pengaturan halaman</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {metaHint ?? "Judul hero dan status terbit yang tampil di halaman publik /apa-kata-mereka."}
              </p>
            </div>
          </div>

          <form
            id="apk-meta-form"
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              if (!gerbangBolehLanjut(event, metaForm, gerbangMeta)) return
              event.preventDefault()
              metaForm.put(metaUrl, {
                preserveScroll: true,
                onSuccess: () => {
                  metaForm.setDefaults()
                  setShowMeta(false)
                },
              })
            }}
          >
            <FieldGrid>
              <Field id="apk-title" label="Judul CMS">
                <Input value={metaForm.data.title} onChange={(event) => metaForm.setData("title", event.target.value)} />
              </Field>
              <CheckboxField
                id="apk-published"
                checked={metaForm.data.published}
                onChange={(checked) => metaForm.setData("published", checked)}
                label="Terbitkan halaman"
              />
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
            </FieldGrid>
            <div className="flex flex-wrap gap-2">
              <SubmitGateButton
                form={metaForm}
                {...gerbangMeta}
              >
                Simpan pengaturan
              </SubmitGateButton>
              <Button type="button" variant="secondary" onClick={() => setShowMeta(false)}>
                Tutup
              </Button>
            </div>
          </form>
        </section>
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
              <thead className="bg-muted/40 text-left text-xs tracking-tight text-muted-foreground">
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
