import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { MediaLibrarySelect } from "@/components/admin/media-library-select"
import { Button } from "@/components/admin/ui/button"
import { CheckboxField, Field, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import AdminLayout from "@/layouts/admin-layout"

interface BannerFormData {
  id?: number
  title?: string | null
  image_url?: string | null
  link_url?: string | null
  sort_order: number
  published: boolean
  media_asset_id?: number | null
}

export default function BannerForm({
  banner,
  submitUrl,
  method,
  indexHref,
  _presignUrl,
  backUrl
}: {
  backUrl?: string | null
  banner: BannerFormData | null
  submitUrl: string
  method: "post" | "put"
  indexHref: string
  _presignUrl?: string
}) {
  const isEdit = Boolean(banner?.id)
  const form = useForm<{
    title: string
    link_url: string
    sort_order: number
    published: boolean
    media_asset_id: string
  }>({
    title: banner?.title ?? "",
    link_url: banner?.link_url ?? "",
    sort_order: banner?.sort_order ?? 0,
    published: banner?.published ?? false,
    media_asset_id: banner?.media_asset_id ? String(banner.media_asset_id) : "",
  })
  const previewUrl = banner?.image_url ?? null

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (method === "put") {
      form.transform((data) => ({ ...data, _method: "put" }))
      form.post(submitUrl, {
        preserveScroll: true,
        onFinish: () => form.transform((data) => data),
      })
      return
    }
    form.post(submitUrl, { preserveScroll: true })
  }

  return (
    <AdminLayout
      backUrl={backUrl}
      title={isEdit ? "Edit Banner Promo" : "Tambah Banner Promo"}
      description="Slide manual beranda (cms_banners): judul, gambar, link, urutan, status published."
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={indexHref}>Batal</Link>
          </Button>
          <Button type="submit" form="banner-form" disabled={form.processing}>
            {form.processing
              ? "Menyimpan..."
              : isEdit
                ? "Simpan"
                  : "Tambah"}
          </Button>
        </div>
      }
    >
      <Head title={`${isEdit ? "Edit" : "Tambah"} Banner Promo | Admin`} />

      <form id="banner-form" onSubmit={onSubmit} className="w-full max-w-4xl space-y-6">
        <FormErrorSummary errors={form.errors} />

        <section className="overflow-hidden rounded-lg border border-border bg-card">
          {/* Stripe media: thumbnail kiri, upload inline kanan */}
          <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:p-6">
            <div className="aspect-[1024/426] w-full max-w-[280px] shrink-0 overflow-hidden rounded-md border border-border bg-muted">
              {previewUrl ? (
                <img src={previewUrl} alt="Pratinjau" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground/60">
                  <span className="px-1 text-center text-[10px] leading-tight">Tanpa gambar</span>
                </div>
              )}
            </div>
            <div className="grid min-w-0 flex-1 gap-4">
              <Field
                id="image"
                label="Gambar dari Media Library"
                error={form.errors.media_asset_id}
                hint="Pilih aset dari Media Library (rasio banner 2,4:1; rekomendasi 1600 × 664 px). Upload file baru dilakukan di halaman Media Library."
              >
                <MediaLibrarySelect
                  value={form.data.media_asset_id}
                  onChange={(value) => form.setData("media_asset_id", value)}
                  kind="image"
                />
              </Field>
            </div>
          </div>

          {/* Field informasi promo */}
          <FieldGrid className="p-5 sm:p-6">
            <Field
              id="title"
              label="Nama / judul promo"
              error={form.errors.title}
              hint="Maksimal 64 karakter agar tetap ringkas di mobile."
            >
              <Input
                value={form.data.title}
                onChange={(event) => form.setData("title", event.target.value)}
                placeholder="Mis. Diskon sampai 30%"
                maxLength={64}
              />
            </Field>
            <Field
              id="link"
              label="Link tujuan / produk terkait"
              error={form.errors.link_url}
              hint="Path internal /product/SKU atau URL penuh."
            >
              <Input
                value={form.data.link_url}
                onChange={(event) => form.setData("link_url", event.target.value)}
                placeholder="/product/WIN-JUNG-001"
              />
            </Field>
            <Field id="sort" label="Urutan slide" error={form.errors.sort_order} className="sm:max-w-40">
              <Input
                type="number"
                value={form.data.sort_order}
                onChange={(event) => form.setData("sort_order", Number(event.target.value))}
              />
            </Field>
            <CheckboxField
              id="banner-published"
              checked={form.data.published}
              onChange={(checked) => form.setData("published", checked)}
              label="Status aktif (published)"
            />
          </FieldGrid>
        </section>

        
      </form>
    </AdminLayout>
  )
}
