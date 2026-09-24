import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { RowActions, RowActionsMenu } from "@/components/admin/row-actions"
import { ReorderActionButton } from "@/components/admin/reorder-action-button"
import { ReorderDragHandle } from "@/components/admin/reorder-drag-handle"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { CheckboxField, Field } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { useRowDragSort } from "@/hooks/use-row-drag-sort"

interface Row {
  id: number
  no: number
  problem: string
  solution: string
  media_count: number
  sort_order: number
  edit_href: string
  destroy_url: string
}

interface PageMeta {
  title: string
  heading: string
  subtitle: string
  published: boolean
}

export default function MasalahSolusiIndex({
  title,
  description,
  filters,
  rows: initialRows = [],
  pageMeta,
  createHref,
  reorderUrl,
  metaUrl,
  previewUrl,
}: {
  title: string
  description: string
  filters: { q: string }
  rows: Row[]
  pageMeta: PageMeta
  createHref: string
  reorderUrl: string
  metaUrl: string
  previewUrl: string
}) {
  const [q, setQ] = React.useState(filters.q)
  const [reorderMode, setReorderMode] = React.useState(false)
  const [rows, setRows] = React.useState(initialRows)
  const [busyId, setBusyId] = React.useState<number | null>(null)

  const metaForm = useForm({
    title: pageMeta.title,
    heading: pageMeta.heading,
    subtitle: pageMeta.subtitle,
    published: pageMeta.published,
  })
  const reorderForm = useForm({
    rows: initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
  })

  React.useEffect(() => {
    // Inertia refresh replaces the editable rows with the server snapshot.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(initialRows)
    // setDefaults, bukan setData: `isDirty` membandingkan data dengan defaults,
    // jadi defaults harus ikut pindah ke snapshot server. Kalau tidak, memuat
    // ulang daftar (misalnya karena pencarian dibersihkan saat mode urut
    // dinyalakan) langsung membuat tombol Simpan urutan muncul tanpa ada geseran.
    reorderForm.setData(
      "rows",
      initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
    )
    reorderForm.setDefaults(
      "rows",
      initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
    )
    // `useForm` returns a new facade on every render; the server snapshot is the only dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRows])

  function apply(next?: Partial<{ q: string }>) {
    router.get(
      routeUrl("admin.masalah-solusi.index"),
      { q: next?.q ?? q },
      { preserveState: true, preserveScroll: true, replace: true },
    )
  }

  function reorderRows(from: number, to: number) {
    if (from === to) return
    const next = [...rows]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    const numbered = next.map((row, i) => ({ ...row, no: i + 1, sort_order: i }))
    setRows(numbered)
    reorderForm.setData(
      "rows",
      numbered.map((row, i) => ({ id: row.id, sort_order: i })),
    )
  }

  // Meta halaman jarang diubah, jadi formnya dilipat supaya daftar item langsung
  // terlihat begitu halaman dibuka (kontrak: flow setting sederhana).
  const [showMeta, setShowMeta] = React.useState(false)

  // Geser-urut dimatikan saat daftar sedang tersaring: posisi target tidak
  // mewakili urutan global, jadi hasil geser bisa salah tempat.
  const canReorder = reorderMode && filters.q.trim() === ""
  const dirty = reorderForm.isDirty

  const dnd = useRowDragSort({
    enabled: canReorder,
    count: rows.length,
    onReorder: reorderRows,
  })

  function toggleReorder() {
    const next = !reorderMode
    setReorderMode(next)
    if (next) {
      // Urutan hanya bisa digeser saat daftar tidak tersaring, jadi pencarian
      // dibersihkan sekaligus saat mode urut dinyalakan.
      setQ("")
      if (filters.q) apply({ q: "" })
    }
  }

  function saveReorder() {
    reorderForm.put(reorderUrl, {
      preserveScroll: true,
      onSuccess: () => setReorderMode(false),
    })
  }

  /** Batalkan mode urut: kembalikan urutan ke snapshot server lalu keluar. */
  function cancelReorder() {
    setRows(initialRows)
    reorderForm.setData(
      "rows",
      initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
    )
    reorderForm.setDefaults(
      "rows",
      initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
    )
    setReorderMode(false)
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary">
            <a href={previewUrl} target="_blank" rel="noreferrer">
              Lihat halaman publik
            </a>
          </Button>
          {/* Satu tombol yang berubah peran mengikuti keadaan (kontrak owner 2026-09-20):
              Urutkan -> Urungkan saat mode aktif -> Simpan urutan begitu ada urutan
              yang benar-benar digeser. Tombol simpan tidak pernah muncul sebelum
              ada perubahan yang perlu disimpan. */}
          <ReorderActionButton
            active={reorderMode}
            dirty={dirty}
            processing={reorderForm.processing}
            disabled={!rows.length}
            onToggle={toggleReorder}
            onCancel={cancelReorder}
            onSave={saveReorder}
          />
          {!reorderMode ? (
            <Button asChild>
              <Link href={createHref}>
                <Icon name="plus" className="size-4" aria-hidden="true" />
                Tambah
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold tracking-tight text-muted-foreground">Meta halaman</p>
          <button
            type="button"
            onClick={() => setShowMeta((current) => !current)}
            className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
          >
            {showMeta ? "Tutup" : "Atur meta halaman"}
          </button>
        </div>

        {!showMeta ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {metaForm.data.heading || metaForm.data.title || "Masalah & Solusi"}
            {metaForm.data.subtitle ? " · " + metaForm.data.subtitle : ""}
          </p>
        ) : null}

        <form
          id="ms-meta-form"
          className={showMeta ? "mt-4 grid gap-4 sm:grid-cols-2" : "hidden"}
          onSubmit={(event) => {
            event.preventDefault()
            metaForm.put(metaUrl)
          }}
        >
          <Field id="ms-title" label="Judul CMS">
            <Input value={metaForm.data.title} onChange={(event) => metaForm.setData("title", event.target.value)} />
          </Field>
          <CheckboxField
            id="ms-published"
            checked={metaForm.data.published}
            onChange={(checked) => metaForm.setData("published", checked)}
            label="Terbitkan halaman"
          />
          <Field id="ms-heading" label="Judul hero" className="sm:col-span-2">
            <Input value={metaForm.data.heading} onChange={(event) => metaForm.setData("heading", event.target.value)} />
          </Field>
          <Field id="ms-subtitle" label="Subjudul" className="sm:col-span-2">
            <Textarea
              rows={2}
              value={metaForm.data.subtitle}
              onChange={(event) => metaForm.setData("subtitle", event.target.value)}
            />
          </Field>
          {/* Tombol simpan duduk di section ini supaya jelas ia menyimpan meta halaman,
              bukan daftar item di bawahnya. Ikut tersembunyi bersama formnya. */}
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={metaForm.processing}>
              {metaForm.processing ? "Menyimpan..." : "Simpan meta"}
            </Button>
          </div>
        </form>
      </section>

      {reorderMode ? (
        <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Mode Urutkan aktif: pakai <span className="font-semibold text-foreground">ikon tarik</span> di tepi kiri baris untuk memindahkan, lalu tekan Simpan urutan.
          {!canReorder ? (
            <span className="font-semibold text-foreground"> Kosongkan pencarian agar urutan bisa diubah.</span>
          ) : null}
        </p>
      ) : (
        <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Urutan baris di bawah ini sama dengan urutan bagian Masalah &amp; Solusi di halaman publik.
        </p>
      )}

      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: () => apply({ q }),
          placeholder: "Cari masalah atau solusi",
        }}

        className="mb-4"
      />

      <Card className="overflow-hidden border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Icon name="alert-circle" className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">Daftar masalah &amp; solusi</h2>
          </div>
          <span className="text-xs text-muted-foreground">{rows.length} baris</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-left text-xs font-medium text-muted-foreground">
                {canReorder ? (
                  <th className="w-12 px-3 py-2" aria-label="Seret" />
                ) : null}
                <th className="w-10 px-3 py-2 text-right">No</th>
                <th className="px-3 py-2">Masalah</th>
                <th className="px-3 py-2">Solusi</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border align-top last:border-0",
                      dnd.draggingIndex === index && "opacity-40",
                      dnd.targetIndex === index && canReorder && "bg-muted/50",
                    )}
                    {...(canReorder ? dnd.rowProps(index) : {})}
                  >
                    {canReorder ? (
                      <td className="px-3 py-2.5 align-middle">
                        <ReorderDragHandle enabled />
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5 text-right align-middle tabular-nums text-xs text-muted-foreground">
                      {row.no}
                    </td>
                    <td className="max-w-[22rem] px-3 py-2.5 align-middle">
                      <p className="whitespace-pre-wrap font-semibold text-foreground">{row.problem}</p>
                    </td>
                    <td className="max-w-[30rem] px-3 py-2.5 align-middle">
                      <p className="whitespace-pre-wrap leading-6 text-muted-foreground">{row.solution}</p>
                      {row.media_count > 0 ? (
                        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          <Icon name="image" className="size-3.5" aria-hidden="true" />
                          {row.media_count} media
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right align-middle">
                      <RowActions className="justify-end">
                        <Button
                          asChild={!reorderMode}
                          variant="secondary"
                          size="xs"
                          disabled={reorderMode}
                        >
                          {reorderMode ? <span>Edit</span> : <Link href={row.edit_href}>Edit</Link>}
                        </Button>
                        <RowActionsMenu>
                          <ConfirmAction
                            trigger={
                              <button
                                type="button"
                                className="w-full px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={busyId === row.id || reorderMode}
                              >
                                Hapus
                              </button>
                            }
                            title="Hapus pasangan ini?"
                            description="Baris masalah & solusi dihapus dari halaman publik."
                            confirmLabel="Hapus"
                            processing={busyId === row.id}
                            onConfirm={() => {
                              setBusyId(row.id)
                              router.delete(row.destroy_url, {
                                preserveScroll: true,
                                onFinish: () => setBusyId(null),
                              })
                            }}
                          />
                        </RowActionsMenu>
                      </RowActions>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canReorder ? 5 : 4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {filters.q
                      ? "Tidak ada yang cocok dengan pencarian."
                      : "Belum ada masalah & solusi."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!rows.length && !filters.q ? (
          <EmptyState
            title="Belum ada masalah & solusi"
            description="Tambahkan pasangan kendala dan rekomendasi untuk edukasi pembeli."
            className="border-0"
          />
        ) : null}
      </Card>
    </AdminLayout>
  )
}
