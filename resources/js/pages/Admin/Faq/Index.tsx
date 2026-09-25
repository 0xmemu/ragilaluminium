import { Head, router, useForm, usePage } from "@inertiajs/react"
import * as React from "react"

import { RowActions, rowActionTextClass } from "@/components/admin/row-actions"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { ReorderActionButton } from "@/components/admin/reorder-action-button"
import { ReorderDragHandle } from "@/components/admin/reorder-drag-handle"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { CheckboxField, Field, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"
import { useRowDragSort } from "@/hooks/use-row-drag-sort"
import { useReorderMode } from "@/hooks/use-reorder-mode"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

interface FaqRow {
  id: number
  no: number
  question: string
  answer: string
  category: string
  status: string
  sort_order: number
  archive_url: string
  unarchive_url: string
  destroy_url: string
}

interface PageMeta {
  title: string
  heading: string
  subtitle: string
  published: boolean
}

type StatusTab = "active" | "archived"

export default function FaqIndex({
  title,
  description,
  filters,
  statusCounts,
  categoryOptions,
  categories,
  rows: initialRows = [],
  pageMeta,
  storeUrl,
  reorderUrl,
  metaUrl,
  previewUrl,
  openCreate = false,
  openMeta = false,
}: {
  title: string
  description: string
  filters: { q: string; category: string; status: StatusTab }
  statusCounts: { active: number; archived: number }
  categoryOptions: Array<{ value: string; label: string }>
  categories: string[]
  rows: FaqRow[]
  pageMeta: PageMeta
  storeUrl: string
  reorderUrl: string
  metaUrl: string
  previewUrl: string
  openCreate?: boolean
  openMeta?: boolean
}) {
  const { flash } = usePage<SharedPageProps>().props
  const status = filters.status === "archived" ? "archived" : "active"
  const isArchivedTab = status === "archived"

  const [q, setQ] = React.useState(filters.q)
  const [category, setCategory] = React.useState(filters.category)
  const [openId, setOpenId] = React.useState<number | null>(null)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [showCreate, setShowCreate] = React.useState(openCreate)
  const [showMeta, setShowMeta] = React.useState(openMeta)
  const createPanelRef = React.useRef<HTMLElement | null>(null)

  const metaForm = useForm({
    title: pageMeta.title,
    heading: pageMeta.heading,
    subtitle: pageMeta.subtitle,
    published: pageMeta.published,
  })
  const createForm = useForm({
    question: "",
    answer: "",
    category: categories[0] ?? "",
  })
  const editForm = useForm({
    question: "",
    answer: "",
    category: categories[0] ?? "",
  })
  const reorderForm = useForm({
    rows: initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
    status,
  })
  // Mode Urutkan dikelola hook bersama; nama variabel dipertahankan supaya JSX
  // dan tombol header tidak perlu berubah.
  const {
    mode: reorderMode,
    setMode: setReorderMode,
    orderedRows: rows,
    move: reorderRows,
    save: saveReorder,
    cancel: cancelReorder,
  } = useReorderMode({
    snapshot: initialRows,
    form: reorderForm,
    url: reorderUrl,
    buildItems: (list) => list.map((row, index) => ({ id: row.id, sort_order: index })),
    numbering: true,
    beforeSave: () => reorderForm.setData("status", status),
    submitOptions: { preserveScroll: true },
    onSync: () => setEditingId(null),
  })


  React.useEffect(() => {
    // Pindah tab membatalkan mode urut. Mode urut tidak boleh direset saat rows
    // berganti, karena menyalakan mode urut membersihkan pencarian dan itu
    // memuat ulang rows, sehingga mode urut akan langsung mati sendiri.
    setReorderMode(false)
  }, [status, setReorderMode])

  React.useEffect(() => {
    // Query flags are navigation inputs, while the local state drives the panel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowCreate(openCreate)
  }, [openCreate])

  React.useEffect(() => {
    // Query flags are navigation inputs, while the local state drives the panel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowMeta(openMeta)
  }, [openMeta])

  React.useEffect(() => {
    if (flash?.success && String(flash.success).includes("ditambahkan")) {
      createForm.reset()
      createForm.clearErrors()
      createForm.setData("category", categories[0] ?? "")
      // Close the create panel after the server confirms creation.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowCreate(false)
    }
    // `useForm` returns a new facade on every render; the flash transition is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash?.success])

  React.useEffect(() => {
    if (!showCreate) return
    const timer = window.setTimeout(() => {
      createPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      document.getElementById("faq-new-question")?.focus()
    }, 50)
    return () => window.clearTimeout(timer)
  }, [showCreate])

  function apply(next?: Partial<{ q: string; category: string; status: StatusTab }>) {
    router.get(
      routeUrl("admin.faq.index"),
      {
        q: next?.q ?? q,
        category: next?.category ?? category,
        status: next?.status ?? status,
      },
      { preserveState: true, preserveScroll: true },
    )
  }

  function openCreatePanel() {
    setShowMeta(false)
    setShowCreate(true)
    setReorderMode(false)
  }

  function closeCreatePanel() {
    setShowCreate(false)
    createForm.reset()
    createForm.clearErrors()
    createForm.setData("category", categories[0] ?? "")
  }

  function toggleMeta() {
    setShowMeta((value) => {
      const next = !value
      if (next) setShowCreate(false)
      return next
    })
  }



  /** Batalkan mode urut: kembalikan urutan ke snapshot server lalu keluar. */

  // Geser-urut hanya sahih saat daftar memuat seluruh baris tab ini: payload
  // simpan hanya berisi baris yang tampil, jadi daftar tersaring akan menulis
  // sort_order parsial dan menabrak urutan baris di luar filter.
  // `status` dikecualikan karena tab memang memisahkan lingkup: urutan yang
  // ditulis hanya untuk baris di tab itu sendiri. Pencarian juga tidak dikunci
  // karena tombol Urutkan membersihkannya sendiri.
  const listTersaring = filters.q.trim() !== "" || filters.category !== ""
  const filterKunci = filters.category !== ""

  function toggleReorder() {
    setReorderMode(true)
    // Urutan tidak bisa digeser saat daftar tersaring, jadi pencarian
    // dibersihkan sekaligus saat mode urut dinyalakan (kontrak owner 2026-09-20).
    if (filters.q) {
      setQ("")
      apply({ q: "" })
    }
  }

  // Ikon tarik hanya ada saat mode Urutkan aktif, tab bukan arsip, dan daftar
  // tidak tersaring (kontrak owner 2026-09-20, direvisi).
  const dragAktif = reorderMode && !isArchivedTab && !listTersaring

  const dnd = useRowDragSort({
    enabled: dragAktif,
    count: rows.length,
    onReorder: reorderRows,
  })

  function startEdit(row: FaqRow) {
    setEditingId(row.id)
    setOpenId(row.id)
    editForm.setData({
      question: row.question,
      answer: row.answer,
      category: row.category,
    })
    editForm.clearErrors()
  }

  function cancelEdit() {
    setEditingId(null)
    editForm.reset()
    editForm.clearErrors()
  }

  const tabs: Array<{ key: StatusTab; label: string; count: number }> = [
    { key: "active", label: "FAQ Aktif", count: statusCounts.active },
    { key: "archived", label: "FAQ Diarsipkan", count: statusCounts.archived },
  ]

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
          <Button type="button" variant="secondary" onClick={toggleMeta}>
            {showMeta ? "Tutup pengaturan" : "Pengaturan halaman"}
          </Button>
          {!isArchivedTab ? (
            <>
              {/* Satu tombol yang berubah peran mengikuti keadaan (kontrak owner 2026-09-20):
                  Urutkan -> Urungkan saat mode aktif -> Simpan urutan begitu ada urutan
                  yang benar-benar digeser. */}
              <ReorderActionButton
                active={reorderMode}
                dirty={reorderForm.isDirty}
                processing={reorderForm.processing}
                disabled={!rows.length || filterKunci}
                disabledReason="Kosongkan filter kategori dulu supaya tombol Urutkan bisa dipakai."
                onToggle={toggleReorder}
                onCancel={cancelReorder}
                onSave={saveReorder}
              />
              {!reorderMode ? (
                <Button type="button" onClick={openCreatePanel}>
                  <Icon name="plus" className="size-4" aria-hidden="true" />
                  Tambah
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        {tabs.map((tab) => {
          const active = tab.key === status
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setShowCreate(false)
                setReorderMode(false)
                apply({ status: tab.key })
              }}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {showMeta ? (
        <section className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold tracking-tight text-muted-foreground">Pengaturan halaman</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Judul hero dan status terbit - jarang diubah. Tutup panel ini setelah selesai.
          </p>
          <form
            id="faq-meta-form"
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              metaForm.put(metaUrl)
            }}
          >
            <FieldGrid>
              <Field id="faq-title" label="Judul CMS">
                <Input value={metaForm.data.title} onChange={(event) => metaForm.setData("title", event.target.value)} />
              </Field>
              <CheckboxField
                id="faq-published"
                checked={metaForm.data.published}
                onChange={(checked) => metaForm.setData("published", checked)}
                label="Terbitkan halaman"
              />
              <Field id="faq-heading" label="Judul hero" className="sm:col-span-2">
                <Input
                  value={metaForm.data.heading}
                  onChange={(event) => metaForm.setData("heading", event.target.value)}
                />
              </Field>
              <Field id="faq-subtitle" label="Subjudul" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={metaForm.data.subtitle}
                  onChange={(event) => metaForm.setData("subtitle", event.target.value)}
                />
              </Field>
            </FieldGrid>
            {/* Tombol simpan duduk di section ini supaya jelas ia menyimpan meta halaman,
                bukan daftar FAQ di bawahnya. Ikut tersembunyi bersama formnya. */}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={metaForm.processing}>
                {metaForm.processing ? "Menyimpan..." : "Simpan pengaturan"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowMeta(false)}>
                Tutup
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {showCreate && !isArchivedTab ? (
        <section
          ref={createPanelRef}
          className="mt-4 rounded-lg border border-primary/25 bg-surface p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-tight text-muted-foreground">Tambah FAQ</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Item baru masuk ke tab Aktif di akhir daftar.
              </p>
            </div>
            <Button type="button" variant="secondary" size="xs" onClick={closeCreatePanel}>
              Tutup
            </Button>
          </div>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              createForm.post(storeUrl, { preserveScroll: true })
            }}
          >
            <FormErrorSummary errors={createForm.errors} />
            <Field id="faq-new-question" label="Pertanyaan" required error={createForm.errors.question}>
              <Input
                id="faq-new-question"
                value={createForm.data.question}
                onChange={(event) => createForm.setData("question", event.target.value)}
                placeholder="Contoh: Apakah tersedia COD?"
              />
            </Field>
            <Field id="faq-new-category" label="Kategori" required error={createForm.errors.category}>
              <Select
                value={createForm.data.category}
                onChange={(event) => createForm.setData("category", event.target.value)}
              >
                {categories.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="faq-new-answer" label="Jawaban" required error={createForm.errors.answer}>
              <Textarea
                rows={4}
                value={createForm.data.answer}
                onChange={(event) => createForm.setData("answer", event.target.value)}
                placeholder="Tuliskan jawaban yang jelas untuk pembeli…"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={createForm.processing || reorderMode}>
                {createForm.processing ? "Menyimpan..." : "Simpan FAQ"}
              </Button>
              <Button type="button" variant="secondary" onClick={closeCreatePanel}>
                Batal
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {reorderMode ? (
        <div className="mt-4 rounded-lg border border-info/20 bg-info/10 px-4 py-3 text-sm text-info">
          Mode Urutkan aktif: pakai <span className="font-semibold">ikon tarik</span> di tepi kiri baris untuk memindahkan, lalu klik Simpan urutan.
        </div>
      ) : null}

      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: () => apply({ q }),
          placeholder: "Cari pertanyaan atau jawaban",
        }}

        className="mt-4"
      >
        <Select
          value={category}
          onChange={(event) => {
            const value = event.target.value
            setCategory(value)
            apply({ category: value })
          }}
          className="w-56"
        >
          {categoryOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </ListToolbar>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        {rows.length ? (
          <ul className="divide-y divide-border">
            {rows.map((row, index) => {
              const open = openId === row.id
              const editing = editingId === row.id
              return (
                <li key={row.id} className={cn("p-4 sm:p-5", dnd.draggingIndex === index && "opacity-40")} {...(dragAktif ? dnd.rowProps(index) : {})}>
                  <div className="flex flex-wrap items-start gap-3">
                    {/* Ikon tarik hanya dirender saat mode Urutkan aktif, jadi tidak
                        ada kolom kosong di luar mode itu (kontrak 2026-09-20, direvisi). */}
                    {dragAktif ? (
                      <ReorderDragHandle enabled className="mt-0.5 shrink-0" />
                    ) : null}
                    <span className="mt-1 tabular-nums text-xs text-muted-foreground">{row.no}</span>
                    <div className="min-w-0 flex-1">
                      {editing ? (
                        <form
                          className="grid gap-3"
                          onSubmit={(event) => {
                            event.preventDefault()
                            editForm.put(routeUrl("admin.faq.update", { faq: row.id }), {
                              preserveScroll: true,
                              onSuccess: () => cancelEdit(),
                            })
                          }}
                        >
                          <FormErrorSummary errors={editForm.errors} />
                          <Field id={`faq-edit-q-${row.id}`} label="Pertanyaan" required error={editForm.errors.question}>
                            <Input
                              value={editForm.data.question}
                              onChange={(event) => editForm.setData("question", event.target.value)}
                            />
                          </Field>
                          <Field id={`faq-edit-c-${row.id}`} label="Kategori" required error={editForm.errors.category}>
                            <Select
                              value={editForm.data.category}
                              onChange={(event) => editForm.setData("category", event.target.value)}
                            >
                              {categories.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field id={`faq-edit-a-${row.id}`} label="Jawaban" required error={editForm.errors.answer}>
                            <Textarea
                              rows={4}
                              value={editForm.data.answer}
                              onChange={(event) => editForm.setData("answer", event.target.value)}
                            />
                          </Field>
                          <div className="flex flex-wrap gap-2">
                            <Button type="submit" disabled={editForm.processing}>
                              {editForm.processing ? "Menyimpan..." : "Simpan"}
                            </Button>
                            <Button type="button" variant="secondary" onClick={cancelEdit}>
                              Batal
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="flex w-full items-start justify-between gap-3 text-left"
                            onClick={() => setOpenId(open ? null : row.id)}
                            aria-expanded={open}
                          >
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-tight text-muted-foreground">
                                {row.category}
                              </p>
                              <p className="mt-1 text-sm font-bold text-foreground">{row.question}</p>
                            </div>
                            <Icon
                              name={open ? "chevron-up" : "chevron-down"}
                              className="mt-1 size-4 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </button>
                          {open ? (
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                              {row.answer}
                            </p>
                          ) : null}
                          <RowActions className="mt-3 justify-start">
                            {!isArchivedTab ? (
                              <>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="xs"
                                  disabled={reorderMode}
                                  onClick={() => startEdit(row)}
                                >
                                  Edit
                                </Button>
                                <ConfirmAction
                                  trigger={
                                    <button
                                      type="button"
                                      className={cn(rowActionTextClass, "text-muted-foreground")}
                                      disabled={busyId === row.id || reorderMode}
                                    >
                                      Arsipkan
                                    </button>
                                  }
                                  title="Arsipkan FAQ?"
                                  description="FAQ hilang dari halaman publik, tetap bisa diaktifkan lagi dari tab Diarsipkan."
                                  confirmLabel="Arsipkan"
                                  processing={busyId === row.id}
                                  onConfirm={() => {
                                    setBusyId(row.id)
                                    setOpenId(null)
                                    router.post(row.archive_url, {}, {
                                      preserveScroll: true,
                                      onFinish: () => setBusyId(null),
                                    })
                                  }}
                                />
                              </>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="xs"
                                  disabled={busyId === row.id}
                                  onClick={() => {
                                    setBusyId(row.id)
                                    router.post(row.unarchive_url, {}, {
                                      preserveScroll: true,
                                      onFinish: () => setBusyId(null),
                                    })
                                  }}
                                >
                                  Aktifkan
                                </Button>
                                <ConfirmAction
                                  trigger={
                                    <button
                                      type="button"
                                      className={cn(rowActionTextClass, "text-destructive")}
                                      disabled={busyId === row.id}
                                    >
                                      Hapus permanen
                                    </button>
                                  }
                                  title="Hapus FAQ permanen?"
                                  description="Tidak bisa dikembalikan. Arsipkan saja jika masih mungkin dibutuhkan."
                                  confirmLabel="Hapus permanen"
                                  processing={busyId === row.id}
                                  onConfirm={() => {
                                    setBusyId(row.id)
                                    setOpenId(null)
                                    router.delete(row.destroy_url, {
                                      preserveScroll: true,
                                      onFinish: () => setBusyId(null),
                                    })
                                  }}
                                />
                              </>
                            )}
                          </RowActions>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            title={isArchivedTab ? "Tidak ada FAQ diarsipkan" : "Belum ada FAQ aktif"}
            description={
              isArchivedTab
                ? "FAQ yang diarsipkan akan muncul di sini."
                : "Klik Tambah untuk menambah pertanyaan baru."
            }
            className="border-0"
            action={
              !isArchivedTab ? (
                <Button type="button" onClick={openCreatePanel}>
                  <Icon name="plus" className="size-4" aria-hidden="true" />
                  Tambah
                </Button>
              ) : undefined
            }
          />
        )}
      </section>
    </AdminLayout>
  )
}
