import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { RowActions, rowActionTextClass } from "@/components/admin/row-actions"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { ConfirmAction } from "@/components/ui/confirm-action"
import { EmptyState } from "@/components/ui/empty-state"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"

interface Row {
  id: number
  no: number
  problem: string
  solution: string
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
    setRows(initialRows)
    reorderForm.setData(
      "rows",
      initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
    )
  }, [initialRows])

  function apply(next?: Partial<{ q: string }>) {
    router.get(
      routeUrl("admin.masalah-solusi.index"),
      { q: next?.q ?? q },
      { preserveState: true, preserveScroll: true },
    )
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    const numbered = next.map((row, i) => ({ ...row, no: i + 1, sort_order: i }))
    setRows(numbered)
    reorderForm.setData(
      "rows",
      numbered.map((row, i) => ({ id: row.id, sort_order: i })),
    )
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <a href={previewUrl} target="_blank" rel="noreferrer">
              Lihat halaman publik
            </a>
          </Button>
          <Button type="button" variant="secondary" onClick={() => setReorderMode((v) => !v)}>
            {reorderMode ? "Nonaktifkan mode geser" : "Aktifkan mode geser"}
          </Button>
          {reorderMode ? (
            <Button type="button" disabled={reorderForm.processing} onClick={() => reorderForm.put(reorderUrl)}>
              {reorderForm.processing ? "Menyimpan..." : "Simpan urutan"}
            </Button>
          ) : (
            <Button asChild>
              <Link href={createHref}>
                <Icon name="plus" className="size-4" aria-hidden="true" />
                Tambah pasangan
              </Link>
            </Button>
          )}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <section className="mb-6 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-6">
        <p className="text-xs font-bold tracking-tight text-muted-foreground">Meta halaman</p>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            metaForm.put(metaUrl)
          }}
        >
          <Field id="ms-title" label="Judul CMS">
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
          <div className="sm:col-span-2">
            <Button type="submit" disabled={metaForm.processing}>
              {metaForm.processing ? "Menyimpan..." : "Simpan meta"}
            </Button>
          </div>
        </form>
      </section>

      {reorderMode ? (
        <div className="mb-4 rounded-lg border border-info/20 bg-info/10 px-4 py-3 text-sm text-info">
          Atur urutan dengan tombol naik/turun, lalu simpan.
        </div>
      ) : null}

      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          apply({ q })
        }}
      >
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Cari masalah atau solusi"
          className="min-w-[16rem] flex-1"
        />
        <Button type="submit">Cari</Button>
      </form>

      <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        {rows.length ? (
          <ul className="divide-y divide-border">
            {rows.map((row, index) => (
              <li key={row.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start gap-3">
                  {reorderMode ? (
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-7 px-2 text-xs"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        ↑
                      </Button>
                      <span className="text-center tabular-nums text-xs text-muted-foreground">{row.no}</span>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-7 px-2 text-xs"
                        disabled={index === rows.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        ↓
                      </Button>
                    </div>
                  ) : (
                    <span className="mt-1 tabular-nums text-xs text-muted-foreground">{row.no}</span>
                  )}
                  <div className="grid min-w-0 flex-1 gap-3 lg:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Masalah</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-foreground">{row.problem}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Solusi</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{row.solution}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 lg:col-span-2">
                      <RowActions>
                        <Button asChild variant="secondary" size="xs">
                          <Link href={row.edit_href}>Edit</Link>
                        </Button>
                        <ConfirmAction
                          trigger={
                            <button
                              type="button"
                              className={cn(rowActionTextClass, "text-destructive")}
                              disabled={busyId === row.id}
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
                      </RowActions>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Belum ada masalah & solusi"
            description="Tambahkan pasangan kendala dan rekomendasi untuk edukasi pembeli."
            className="border-0"
          />
        )}
      </section>
    </AdminLayout>
  )
}
