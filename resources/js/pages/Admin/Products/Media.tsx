import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"

interface VariantOption {
  id: number
  label: string
  variant_sku: string
  status: string
}

interface MediaRow {
  id: number
  position: number
  status: string
  error_reason?: string | null
  visibility: string
  is_main_image: boolean
  show_in_catalog: boolean
  is_installation: boolean
  installation_caption?: string | null
  product_variant_id: number | null
  variant_label: string
  thumb_url?: string | null
  media_kind?: string
  media_url?: string | null
  update_url: string
  set_main_url: string
  archive_url: string
  redownload_url: string
  destroy_url?: string | null
}

interface LibraryAsset {
  id: number
  label: string
  kind: string
  status: string
  usage_count: number
  thumb_url?: string | null
  media_url?: string | null
}

function MediaRowCard({
  row,
  variants,
}: {
  row: MediaRow
  variants: VariantOption[]
}) {
  const updateForm = useForm({
    position: row.position,
    visibility: row.visibility,
    show_in_catalog: row.show_in_catalog,
    is_installation: row.is_installation,
    installation_caption: row.installation_caption ?? "",
    product_variant_id: row.product_variant_id ? String(row.product_variant_id) : "",
  })
  const actionForm = useForm({})

  return (
    <article className="border-b border-border p-4 last:border-b-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md border border-border bg-muted/30">
          {row.media_kind === "video" && row.media_url ? (
            <video src={row.media_url} controls muted preload="metadata" className="h-full w-full object-cover" />
          ) : row.thumb_url ? (
            <img src={row.thumb_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Belum ada
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs font-semibold text-muted-foreground">#{row.id}</p>
            <StatusBadge status={row.status} />
            {row.is_main_image ? <StatusBadge status="active" label="Utama" /> : null}
            {row.is_installation ? <StatusBadge tone="info" label="Hasil pasang" /> : null}
            {!row.show_in_catalog ? <StatusBadge tone="neutral" label="Non-katalog" /> : null}
            <span className="truncate text-xs text-muted-foreground">{row.variant_label}</span>
          </div>
          {row.status === "failed" && row.error_reason ? (
            <p className="text-xs leading-5 text-destructive">{row.error_reason}</p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field id={`media-position-${row.id}`} label="Posisi" error={updateForm.errors.position}>
              <Input
                type="number"
                min="1"
                max="109"
                value={updateForm.data.position}
                onChange={(event) => updateForm.setData("position", Number(event.target.value))}
              />
            </Field>
            <Field id={`media-visibility-${row.id}`} label="Visibilitas" error={updateForm.errors.visibility}>
              <Select
                value={updateForm.data.visibility}
                onChange={(event) => updateForm.setData("visibility", event.target.value)}
              >
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <Field
              id={`media-variant-${row.id}`}
              label="Tautkan ke varian"
              error={updateForm.errors.product_variant_id}
              className="min-w-0"
            >
              <Select
                value={updateForm.data.product_variant_id}
                onChange={(event) => updateForm.setData("product_variant_id", event.target.value)}
                className="w-full min-w-0"
              >
                <option value="">Semua (produk)</option>
                {variants.map((variant) => (
                  <option key={variant.id} value={String(variant.id)}>
                    {variant.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={updateForm.data.show_in_catalog}
                onChange={(event) => updateForm.setData("show_in_catalog", event.target.checked)}
              />
              Galeri katalog
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={updateForm.data.is_installation}
                onChange={(event) => updateForm.setData("is_installation", event.target.checked)}
              />
              Hasil pemasangan
            </label>
          </div>

          <Field
            id={`media-caption-${row.id}`}
            label="Deskripsi hasil pemasangan (opsional)"
            hint="Tampil saat foto diperbesar di halaman Hasil Pemasangan."
          >
            <Textarea
              rows={2}
              maxLength={280}
              value={updateForm.data.installation_caption}
              onChange={(event) => updateForm.setData("installation_caption", event.target.value)}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                updateForm.transform((data) => ({
                    ...data,
                    product_variant_id:
                      data.product_variant_id === "" ? null : Number(data.product_variant_id),
                  }))
                updateForm.put(row.update_url, { preserveScroll: true })
              }}
              disabled={updateForm.processing}
            >
              Simpan
            </Button>
            {!row.is_main_image ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => actionForm.post(row.set_main_url, { preserveScroll: true })}
                disabled={actionForm.processing}
              >
                Jadikan utama
              </Button>
            ) : null}
            {row.status === "failed" || row.status === "pending" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => actionForm.post(row.redownload_url, { preserveScroll: true })}
                disabled={actionForm.processing}
              >
                Unduh ulang
              </Button>
            ) : null}
            {row.destroy_url ? (
              <ConfirmAction
                trigger={
                  <Button variant="ghost" size="sm" className="text-destructive">
                    Hapus
                  </Button>
                }
                title="Hapus media gagal?"
                description="Media berstatus gagal akan dihapus permanen dari database (dan file lokal bila ada)."
                confirmLabel="Hapus permanen"
                processing={actionForm.processing}
                onConfirm={() =>
                  actionForm.delete(row.destroy_url!, { preserveScroll: true })
                }
              />
            ) : null}
            {row.visibility !== "archived" ? (
              <ConfirmAction
                trigger={
                  <Button variant="ghost" size="sm">
                    Arsipkan
                  </Button>
                }
                title="Arsipkan media?"
                description={`Media #${row.id} tidak dihapus, tetapi tidak lagi tampil.`}
                confirmLabel="Arsipkan"
                processing={actionForm.processing}
                onConfirm={() => actionForm.post(row.archive_url, { preserveScroll: true })}
              />
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}

export default function ProductMediaPage({
  product,
  variants = [],
  filters,
  assetSearch = "",
  assetFilters,
  library = [],
  storeUrl,
  indexUrl,
  rows = [],
}: {
  product: {
    id: number
    name: string
    parent_sku: string
    show_href: string
    variants_href: string
  }
  variants: VariantOption[]
  filters: { variant: string }
  assetSearch?: string
  assetFilters?: { kind: string; status: string }
  library?: LibraryAsset[]
  storeUrl: string
  indexUrl: string
  rows: MediaRow[]
}) {
  const [variantFilter, setVariantFilter] = React.useState(filters.variant)
  const [librarySearch, setLibrarySearch] = React.useState(assetSearch)
  const [libraryKind, setLibraryKind] = React.useState(assetFilters?.kind ?? "")
  const [libraryStatus, setLibraryStatus] = React.useState(assetFilters?.status ?? "")
  const form = useForm<{
    kind: "image" | "video"
    media_asset_id: string
    source_url: string
    position: number
    is_main_image: boolean
    show_in_catalog: boolean
    is_installation: boolean
    installation_caption: string
    visibility: string
    product_variant_id: string
    upload: File | null
  }>({
    kind: "image",
    media_asset_id: "",
    source_url: "",
    position: 1,
    is_main_image: false,
    show_in_catalog: true,
    is_installation: false,
    installation_caption: "",
    visibility: "visible",
    product_variant_id:
      filters.variant && filters.variant !== "shared" ? filters.variant : "",
    upload: null,
  })

  function applyFilter(next: string) {
    setVariantFilter(next)
    router.get(
      indexUrl,
      { variant: next || undefined, q: librarySearch || undefined, kind: libraryKind || undefined, asset_status: libraryStatus || undefined },
      { preserveState: true, preserveScroll: true },
    )
  }

  function searchLibrary() {
    router.get(
      indexUrl,
      { variant: variantFilter || undefined, q: librarySearch || undefined, kind: libraryKind || undefined, asset_status: libraryStatus || undefined },
      { preserveState: true, preserveScroll: true },
    )
  }

  return (
    <AdminLayout
      title={`Media · ${product.parent_sku}`}
      description="Tautkan gambar ke warna/kaca/varian agar galeri PDP berganti sesuai pilihan pelanggan."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={product.variants_href}>Kelola varian</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={product.show_href}>Kembali ke produk</Link>
          </Button>
        </div>
      }
    >
      <Head title={`Media ${product.parent_sku} | Admin`} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={variantFilter}
          onChange={(event) => applyFilter(event.target.value)}
          className="min-w-[16rem]"
        >
          <option value="">Semua media</option>
          <option value="shared">Hanya bersama (tanpa varian)</option>
          {variants.map((variant) => (
            <option key={variant.id} value={String(variant.id)}>
              {variant.label}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          {rows.length} media · {variants.length} varian tersedia
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div className="border-b border-border p-5">
            <h2 className="text-xl font-semibold">Kelola media</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Gambar dengan tautan varian hanya tampil saat opsi itu dipilih di toko. Kosongkan tautan =
              gambar bersama semua varian.
            </p>
          </div>
          {rows.length ? (
            rows.map((row) => <MediaRowCard key={row.id} row={row} variants={variants} />)
          ) : (
            <EmptyState
              className="border-0"
              icon="image"
              title="Belum ada media pada filter ini"
              description="Unggah gambar di panel kanan dan pilih varian warna/kaca yang sesuai."
            />
          )}
        </section>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            form.transform((data) => ({
                ...data,
                product_variant_id:
                  data.product_variant_id === "" ? null : Number(data.product_variant_id),
              }))
            form.post(storeUrl, {
              forceFormData: true,
              preserveScroll: true,
              onSuccess: () => {
                form.reset("source_url", "upload", "is_main_image")
                form.setData("position", 1)
                form.setData("visibility", "visible")
              },
            })
          }}
          className="rounded-xl border border-border bg-card p-5 shadow-sm xl:sticky xl:top-24"
        >
          <h2 className="text-xl font-semibold">Tambah media</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Untuk 4 warna × 3 kaca: pasang gambar/video per kombinasi varian, atau media umum tanpa tautan.
          </p>
          <FormErrorSummary errors={form.errors} className="mt-4" />
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Media Library bersama</p>
                {form.data.media_asset_id ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => form.setData("media_asset_id", "")}>Batal pilih</Button>
                ) : null}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Pasang aset yang sudah ada tanpa upload ulang. Satu media bisa dipakai banyak produk.</p>
              <div className="mt-3 flex gap-2">
                <Input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Cari motif, label, atau URL" />
                <Select value={libraryKind} onChange={(event) => setLibraryKind(event.target.value)} aria-label="Jenis media library">
                  <option value="">Semua</option>
                  <option value="image">Gambar</option>
                  <option value="video">Video</option>
                </Select>
                <Select value={libraryStatus} onChange={(event) => setLibraryStatus(event.target.value)} aria-label="Status media library">
                  <option value="">Semua status</option>
                  <option value="ready">Siap</option>
                  <option value="pending">Menunggu</option>
                  <option value="failed">Gagal</option>
                </Select>
                <Button type="button" variant="secondary" onClick={searchLibrary}>Cari</Button>
              </div>
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                {library.length ? library.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      form.setData("media_asset_id", String(asset.id))
                      form.setData("kind", asset.kind === "video" ? "video" : "image")
                      if (asset.kind === "video") form.setData("is_main_image", false)
                      form.setData("upload", null)
                      form.setData("source_url", "")
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors ${form.data.media_asset_id === String(asset.id) ? "border-primary bg-primary/10" : "border-border hover:bg-surface-muted"}`}
                  >
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded border border-border bg-muted/30">
                      {asset.kind === "video" && asset.media_url ? <video src={asset.media_url} muted preload="metadata" className="h-full w-full object-cover" /> : asset.thumb_url ? <img src={asset.thumb_url} alt="" className="h-full w-full object-cover" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{asset.label}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">{asset.status} · Dipakai di {asset.usage_count} produk</span>
                    </span>
                  </button>
                )) : <p className="py-3 text-xs text-muted-foreground">Belum ada aset bersama yang cocok.</p>}
              </div>
            </div>
            <Field id="media-kind" label="Jenis media" error={form.errors.kind}>
              <Select
                value={form.data.kind}
                disabled={Boolean(form.data.media_asset_id)}
                onChange={(event) => {
                  const kind = event.target.value as "image" | "video"
                  form.setData("kind", kind)
                  if (kind === "video") form.setData("is_main_image", false)
                }}
              >
                <option value="image">Gambar</option>
                <option value="video">Video (MP4/WebM/MOV)</option>
              </Select>
            </Field>
            <Field id="media-upload" label={form.data.kind === "video" ? "File video" : "File gambar"} error={form.errors.upload}>
              <Input
                type="file"
                accept={form.data.kind === "video" ? "video/mp4,video/webm,video/quicktime" : "image/*"}
                disabled={Boolean(form.data.media_asset_id)}
                onChange={(event) => form.setData("upload", event.target.files?.[0] ?? null)}
              />
            </Field>
            <Field id="media-source-url" label="URL sumber" error={form.errors.source_url}>
              <Input
                type="url"
                value={form.data.source_url}
                disabled={Boolean(form.data.media_asset_id)}
                onChange={(event) => form.setData("source_url", event.target.value)}
              />
            </Field>
            <Field
              id="media-variant"
              label="Tautkan ke varian"
              error={form.errors.product_variant_id}
              hint="Pilih Warna / Kaca agar galeri PDP ikut berganti."
            >
              <Select
                value={form.data.product_variant_id}
                onChange={(event) => form.setData("product_variant_id", event.target.value)}
              >
                <option value="">Semua (produk)</option>
                {variants.map((variant) => (
                  <option key={variant.id} value={String(variant.id)}>
                    {variant.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field id="media-position" label="Posisi" required error={form.errors.position}>
                <Input
                  type="number"
                  min="1"
                  max="109"
                  value={form.data.position}
                  onChange={(event) => form.setData("position", Number(event.target.value))}
                />
              </Field>
              <Field id="media-visibility" label="Visibilitas" required error={form.errors.visibility}>
                <Select
                  value={form.data.visibility}
                  onChange={(event) => form.setData("visibility", event.target.value)}
                >
                  <option value="visible">Visible</option>
                  <option value="hidden">Hidden</option>
                  <option value="archived">Archived</option>
                </Select>
              </Field>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.data.is_main_image}
                disabled={form.data.kind === "video"}
                onChange={(event) => form.setData("is_main_image", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Jadikan gambar utama produk
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.data.show_in_catalog}
                onChange={(event) => form.setData("show_in_catalog", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Tampil di galeri katalog
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.data.is_installation}
                onChange={(event) => form.setData("is_installation", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Hasil pemasangan
            </label>
          </div>
          <Button
            type="submit"
            className="mt-5 w-full"
            disabled={form.processing || (!form.data.media_asset_id && !form.data.upload && !form.data.source_url)}
          >
            <Icon name="upload" className="h-4 w-4" aria-hidden="true" />
            {form.processing ? "Menyimpan..." : form.data.media_asset_id ? "Pasang tanpa upload ulang" : "Tambah media"}
          </Button>
        </form>
      </div>
    </AdminLayout>
  )
}
