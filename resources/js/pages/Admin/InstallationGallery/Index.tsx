import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { RowActions, rowActionTextClass } from "@/components/admin/row-actions"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/admin/ui/dialog"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Field } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { Pagination as PaginationData } from "@/types"

interface FotoRow {
  id: number | string
  no: number
  label: string
  image_url: string
  published: boolean
  sort_order: number
  created_at?: string | null
  source?: "import" | "manual"
  readonly?: boolean
  edit_href: string
  publish_url?: string | null
  unpublish_url?: string | null
  media_asset_id?: number | null
  attach_url?: string | null
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
  readonly = false,
}: {
  published: boolean
  editHref: string
  publishUrl?: string | null
  unpublishUrl?: string | null
  busy: boolean
  onBusy: (value: boolean) => void
  readonly?: boolean
}) {
  return (
    <RowActions>
      <Button asChild variant="secondary" size="xs">
        <Link href={editHref}>{readonly ? "Kelola media" : "Edit"}</Link>
      </Button>
      {readonly ? null : published ? (
        <ConfirmAction
          trigger={
            <button type="button" className={cn(rowActionTextClass, "text-destructive")} disabled={busy}>
              Sembunyikan
            </button>
          }
          title="Sembunyikan foto?"
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
        <Button
          size="xs"
          disabled={busy || !publishUrl}
          onClick={() => {
            if (!publishUrl) return
            onBusy(true)
            router.post(publishUrl, {}, { preserveScroll: true, onFinish: () => onBusy(false) })
          }}
        >
          Publikasikan
        </Button>
      )}
    </RowActions>
  )
}

function AttachProductsDialog({ row }: { row: FotoRow }) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<Array<{ id: number; label: string }>>([])
  const [selectedIds, setSelectedIds] = React.useState<number[]>([])
  const [verified, setVerified] = React.useState(false)
  const [searching, setSearching] = React.useState(false)
  const attachForm = useForm({
    product_ids: [] as number[],
    position: Math.max(1, row.sort_order || 1),
    show_in_catalog: false,
    is_installation: true,
    is_main_image: false,
    visibility: "visible",
  })

  React.useEffect(() => {
    if (!open) return
    const term = query.trim()
    if (!term) {
      // Clear stale search results when the dialog query is emptied.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      return
    }
    const timer = window.setTimeout(() => {
      setSearching(true)
      void fetch(`${routeUrl("admin.media.products.search")}?q=${encodeURIComponent(term)}`, {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
        .then((body: { products?: Array<{ id: number; label: string }> }) => setResults(body.products ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [open, query])

  function close() {
    setOpen(false)
    setQuery("")
    setResults([])
    setSelectedIds([])
    setVerified(false)
    attachForm.clearErrors()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button type="button" size="xs" variant="secondary">
          Pasang ke produk lain
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogTitle>Verifikasi dan pasang ke produk lain</DialogTitle>
        <DialogDescription>
          Media ini tetap satu asset, tetapi dapat dipakai sebagai hasil pemasangan di beberapa produk.
          Pastikan kecocokan foto sebelum mengonfirmasi.
        </DialogDescription>
        <div className="space-y-4">
          <Field id={`installation-product-search-${row.id}`} label="Cari produk tujuan">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nama produk atau SKU"
              autoComplete="off"
            />
          </Field>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
            {searching ? (
              <p className="p-3 text-sm text-muted-foreground">Mencari produk...</p>
            ) : results.length ? (
              results.map((product) => (
                <label key={product.id} className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(product.id)}
                    onChange={() => setSelectedIds((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])}
                    className="size-4 accent-primary"
                  />
                  <span className="text-sm">{product.label}</span>
                </label>
              ))
            ) : (
              <p className="p-3 text-sm text-muted-foreground">Ketik minimal sebagian nama atau SKU produk.</p>
            )}
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <input
              type="checkbox"
              checked={verified}
              onChange={(event) => setVerified(event.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>Saya sudah memverifikasi bahwa foto ini benar-benar relevan untuk semua produk yang dipilih.</span>
          </label>
          {attachForm.errors.product_ids ? <p className="text-xs text-destructive">{attachForm.errors.product_ids}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>Batal</Button>
            <Button
              type="button"
              disabled={!verified || selectedIds.length === 0 || attachForm.processing}
              onClick={() => {
                attachForm.transform((data) => ({ ...data, product_ids: selectedIds }))
                attachForm.post(row.attach_url!, { preserveScroll: true, onSuccess: close })
              }}
            >
              {attachForm.processing ? "Memasang..." : `Pasang ke ${selectedIds.length || "produk"}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function InstallationGalleryIndex({
  title,
  description,
  filters,
  sortOptions,
  publishedOptions,
  createHref,
  createLabel,
  rows = [],
  importedRows = [],
  pagination,
  pageMeta = null,
  metaUrl = null,
  metaHint = null,
  previewUrl = null,
}: {
  title: string
  description: string
  filters: { q: string; sort: string; published: string }
  sortOptions: Array<{ value: string; label: string }>
  publishedOptions: Array<{ value: string; label: string }>
  createHref: string
  createLabel: string
  rows?: FotoRow[]
  importedRows?: FotoRow[]
  pagination: PaginationData | null
  pageMeta?: { title: string; heading: string; subtitle: string; published: boolean } | null
  metaUrl?: string | null
  metaHint?: string | null
  previewUrl?: string | null
}) {
  const [q, setQ] = React.useState(filters.q)
  const [sort, setSort] = React.useState(filters.sort)
  const [published, setPublished] = React.useState(filters.published)
  const [busyId, setBusyId] = React.useState<number | string | null>(null)
  const metaForm = useForm({
    title: pageMeta?.title ?? "",
    heading: pageMeta?.heading ?? "",
    subtitle: pageMeta?.subtitle ?? "",
    published: pageMeta?.published ?? true,
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

  function apply(next?: Partial<{ q: string; sort: string; published: string }>) {
    const params: Record<string, string> = {
      q: next?.q ?? q,
      published: next?.published ?? published,
    }
    if (sortOptions.length > 0) {
      params.sort = next?.sort ?? sort
    }
    router.get(routeUrl("admin.hasil-pemasangan.index"), params, { preserveState: true, preserveScroll: true })
  }

  return (
    <AdminLayout title={title} description={description} actions={undefined}>
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
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              metaForm.put(metaUrl)
            }}
          >
            <Field id="igp-title" label="Judul CMS">
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
            <Field id="igp-heading" label="Judul hero" className="sm:col-span-2">
              <Input value={metaForm.data.heading} onChange={(event) => metaForm.setData("heading", event.target.value)} />
            </Field>
            <Field id="igp-subtitle" label="Subjudul" className="sm:col-span-2">
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
          </div>
        </details>
      ) : null}

      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: () => apply({ q }),
          placeholder: "Cari label atau URL foto",
        }}
        actions={
          <div className="flex flex-wrap gap-2">
            {previewUrl ? (
              <Button asChild variant="secondary">
                <a href={previewUrl} target="_blank" rel="noreferrer">
                  Lihat halaman publik
                </a>
              </Button>
            ) : null}
            <Button asChild>
              <Link href={createHref}>
                <Icon name="plus" className="size-4" aria-hidden="true" />
                {createLabel}
              </Link>
            </Button>
          </div>
        }
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
        >
          {publishedOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {sortOptions.length > 0 ? (
          <Select
            value={sort}
            onChange={(event) => {
              const value = event.target.value
              setSort(value)
              apply({ sort: value })
            }}
            className="w-44"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : null}
      </ListToolbar>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
        {rows.length + importedRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-tight text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-semibold">No</th>
                  <th className="px-3 py-3 font-semibold">Foto</th>
                  <th className="px-3 py-3 font-semibold">Label</th>
                  <th className="px-3 py-3 font-semibold">Sumber</th>
                  <th className="px-3 py-3 font-semibold">Urutan</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Tanggal</th>
                  <th className="px-3 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {[...importedRows, ...rows].map((row) => (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">{row.no}</td>
                    <td className="px-3 py-3">
                      {row.image_url ? (
                        <img
                          src={row.image_url}
                          alt=""
                          className="h-16 w-24 rounded-md border border-border object-cover"
                        />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Link href={row.edit_href} className="font-semibold hover:text-primary hover:underline">
                        {row.label}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {row.source === "import" ? "Import produk" : "Manual"}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">{row.sort_order}</td>
                    <td className="px-3 py-3">
                      <StatusBadge
                        status={row.published ? "active" : "inactive"}
                        label={row.published ? "Published" : "Draft"}
                      />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{formatDateTime(row.created_at)}</td>
                    <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
                      <PublishActions
                        published={row.published}
                        editHref={row.edit_href}
                        publishUrl={row.publish_url}
                        unpublishUrl={row.unpublish_url}
                        busy={busyId === row.id}
                        onBusy={(value) => setBusyId(value ? row.id : null)}
                        readonly={Boolean(row.readonly)}
                      />
                      {row.attach_url ? <AttachProductsDialog row={row} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Belum ada foto pemasangan"
            description="Tambahkan foto hasil pemasangan untuk halaman /hasil-pemasangan."
            className="border-0"
          />
        )}
        {pagination ? (
          <div className="border-t border-border px-4 py-3">
            <Pagination pagination={pagination} />
          </div>
        ) : null}
      </section>
    </AdminLayout>
  )
}
