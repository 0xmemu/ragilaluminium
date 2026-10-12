import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { ReorderActionButton } from "@/components/admin/reorder-action-button"
import { ReorderDragHandle } from "@/components/admin/reorder-drag-handle"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { useRowDragSort } from "@/hooks/use-row-drag-sort"

interface SectionRow {
  key: string
  enabled: boolean
  sort_order: number
  label: string
  description: string
  icon: string
  edit_href?: string | null
}

export default function BerandaIndex({
  title,
  description,
  sections: initialSections,
  submitUrl,
}: {
  title: string
  description: string
  sections: SectionRow[]
  submitUrl: string
}) {
  const [sections, setSections] = React.useState(initialSections)
  const [reorderMode, setReorderMode] = React.useState(false)
  const form = useForm({
    sections: initialSections.map((section) => ({
      key: section.key,
      enabled: section.enabled,
      sort_order: section.sort_order,
    })),
  })

  React.useEffect(() => {
    // Inertia refresh replaces the editable section list with the server snapshot.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSections(initialSections)
    // Data dan defaults dipindah bersama: `isDirty` membandingkan data dengan
    // defaults, jadi keduanya harus berisi snapshot server yang sama.
    form.setData(
      "sections",
      initialSections.map((section) => ({
        key: section.key,
        enabled: section.enabled,
        sort_order: section.sort_order,
      })),
    )
    form.setDefaults(
      "sections",
      initialSections.map((section) => ({
        key: section.key,
        enabled: section.enabled,
        sort_order: section.sort_order,
      })),
    )
    // `useForm` returns a new facade on every render; the server snapshot is the only dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSections])

  function syncForm(next: SectionRow[]) {
    const ordered = next.map((section, index) => ({ ...section, sort_order: index }))
    setSections(ordered)
    form.setData(
      "sections",
      ordered.map((section) => ({
        key: section.key,
        enabled: section.enabled,
        sort_order: section.sort_order,
      })),
    )
  }

  function reorderSections(from: number, to: number) {
    if (from === to) return
    const next = [...sections]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    syncForm(next)
  }

  // Ikon tarik hanya ada saat mode Urutkan aktif (kontrak owner 2026-09-20, direvisi).
  const dragAktif = reorderMode && sections.length > 1

  const dnd = useRowDragSort({
    enabled: dragAktif,
    count: sections.length,
    onReorder: reorderSections,
  })

  // Perubahan urutan dihitung terhadap snapshot server, TERPISAH dari perubahan
  // switch tampil. Form yang sama memuat urutan sekaligus status tampil, jadi
  // form.isDirty ikut bernilai true saat switch dinyalakan dan tombol berubah
  // jadi "Simpan urutan" padahal urutan baris tidak berubah.
  const urutanBerubah =
    sections.map((section) => section.key).join("|") !==
    initialSections.map((section) => section.key).join("|")

  /** Batalkan mode urut: kembalikan urutan ke snapshot server lalu keluar. */
  function cancelReorder() {
    setSections(initialSections)
    form.setData(
      "sections",
      initialSections.map((section) => ({
        key: section.key,
        enabled: section.enabled,
        sort_order: section.sort_order,
      })),
    )
    form.setDefaults(
      "sections",
      initialSections.map((section) => ({
        key: section.key,
        enabled: section.enabled,
        sort_order: section.sort_order,
      })),
    )
    setReorderMode(false)
  }

  // Kontrak halaman pengaturan (ADR-023): halaman yang tugasnya mengubah nilai
  // yang sudah ada dibuka terkunci. Saklar tampil dan pengurutan baru bisa
  // dipakai setelah admin menekan Edit, supaya tata letak beranda tidak rawan
  // tersunting tanpa sengaja saat halaman cuma dibuka untuk melihat.
  const [mode, setMode] = React.useState<"view" | "edit">("view")
  const terkunci = mode === "view"

  function batal() {
    // Kembalikan urutan dan switch ke snapshot server, lalu kunci lagi.
    cancelReorder()
    setSections(initialSections)
    form.resetAndClearErrors()
    setMode("view")
  }

  function toggleEnabled(index: number) {
    const next = sections.map((section, i) =>
      i === index ? { ...section, enabled: !section.enabled } : section,
    )
    syncForm(next)
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      lockInteraction={reorderMode}
      actions={
        <div className="flex flex-wrap gap-2">
          {mode === "view" ? (
            <Button type="button" variant="secondary" asChild>
              <Link href={routeUrl("admin.beranda.index")}>Batal</Link>
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={batal}>
              Batal
            </Button>
          )}
          {/* Satu tombol yang berubah peran mengikuti keadaan (kontrak owner 2026-09-20).
              Saat mode Urutkan aktif, tombol ini menggantikan Simpan: form yang sama
              memuat urutan sekaligus status tampil tiap bagian, jadi satu tombol
              simpan sudah mewakili seluruh perubahan. Label "Simpan urutan" hanya
              muncul bila urutan baris benar-benar berubah. */}
          {mode === "edit" ? (
            <>
              <ReorderActionButton
                active={reorderMode}
                dirty={urutanBerubah}
                processing={form.processing}
                disabled={sections.length < 2}
                onToggle={() => setReorderMode(true)}
                onCancel={cancelReorder}
                onSave={() =>
                  form.put(submitUrl, {
                    onSuccess: () => {
                      form.setDefaults()
                      setReorderMode(false)
                      setMode("view")
                    },
                  })
                }
              />
              {!reorderMode ? (
                <Button
                  type="button"
                  disabled={form.processing}
                  onClick={() =>
                    form.put(submitUrl, {
                      onSuccess: () => {
                        // Simpan berhasil = kondisi baru jadi acuan Batal berikutnya.
                        form.setDefaults()
                        setMode("view")
                      },
                    })
                  }
                >
                  {form.processing ? "Menyimpan..." : "Simpan"}
                </Button>
              ) : null}
            </>
          ) : (
            <Button type="button" size="sm" onClick={() => setMode("edit")}>
              <Icon name="pencil" className="size-3.5" aria-hidden="true" />
              Edit
            </Button>
          )}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <ul className="divide-y divide-border">
        {sections.map((section, index) => (
          <li
            key={section.key}
            className={cn("flex flex-wrap items-center gap-3 p-4 sm:p-5", dnd.draggingIndex === index && "opacity-40")}
            {...(dragAktif ? dnd.rowProps(index) : {})}
          >
            {/* Ikon tarik hanya dirender saat mode Urutkan aktif, jadi tidak ada
                ruang kosong di luar mode itu (kontrak owner 2026-09-20, direvisi). */}
            {dragAktif ? <ReorderDragHandle enabled /> : null}

            <span className="inline-flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon name={section.icon} className="size-5" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold tracking-tight">{section.label}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{section.description}</p>
            </div>

            {/* Switch status tampil dikunci selama mode Urutkan: tombol Simpan biasa
                disembunyikan di mode itu, sedangkan "Simpan urutan" hanya menyala bila
                urutan baris berubah. Tanpa dikunci, perubahan switch di mode Urutkan
                tidak punya jalan simpan. Seragam dengan halaman lain yang mengunci
                aksi non-urutan selama mode Urutkan aktif. */}
            <button
              type="button"
              onClick={() => toggleEnabled(index)}
              disabled={reorderMode || terkunci}
              className="inline-flex items-center gap-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <StatusBadge
                status={section.enabled ? "active" : "inactive"}
                label={section.enabled ? "Aktif" : "Nonaktif"}
              />
            </button>

            {section.edit_href ? (
              <Button asChild variant="secondary" size="xs" className="px-3">
                <Link href={section.edit_href}>Edit konten</Link>
              </Button>
            ) : null}
          </li>
        ))}
        </ul>
      </section>
    </AdminLayout>
  )
}
