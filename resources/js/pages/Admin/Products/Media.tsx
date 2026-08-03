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
  update_url: string
  set_main_url: string
  archive_url: string
  redownload_url: string
  destroy_url?: string | null
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
          {row.thumb_url ? (
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
  storeUrl: string
  indexUrl: string
  rows: MediaRow[]
}) {
  const [variantFilter, setVariantFilter] = React.useState(filters.variant)
  const form = useForm<{
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
      next ? { variant: next } : {},
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
          {rows.length} gambar · {variants.length} varian tersedia
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
            Untuk 4 warna × 3 kaca: unggah foto per kombinasi varian, atau foto umum tanpa tautan.
          </p>
          <FormErrorSummary errors={form.errors} className="mt-4" />
          <div className="mt-5 space-y-4">
            <Field id="media-upload" label="File gambar" error={form.errors.upload}>
              <Input
                type="file"
                accept="image/*"
                onChange={(event) => form.setData("upload", event.target.files?.[0] ?? null)}
              />
            </Field>
            <Field id="media-source-url" label="URL sumber" error={form.errors.source_url}>
              <Input
                type="url"
                value={form.data.source_url}
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
            disabled={form.processing || (!form.data.upload && !form.data.source_url)}
          >
            <Icon name="upload" className="h-4 w-4" aria-hidden="true" />
            {form.processing ? "Mengunggah..." : "Tambah media"}
          </Button>
        </form>
      </div>
    </AdminLayout>
  )
}
