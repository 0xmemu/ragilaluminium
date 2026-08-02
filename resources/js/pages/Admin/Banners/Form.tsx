import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import AdminLayout from "@/layouts/admin-layout"

interface BannerFormData {
  id?: number
  title?: string | null
  image_url?: string | null
  link_url?: string | null
  sort_order: number
  published: boolean
}

export default function BannerForm({
  banner,
  submitUrl,
  method,
  indexHref,
}: {
  banner: BannerFormData | null
  submitUrl: string
  method: "post" | "put"
  indexHref: string
}) {
  const isEdit = Boolean(banner?.id)
  const form = useForm<{
    title: string
    link_url: string
    sort_order: number
    published: boolean
    image: File | null
  }>({
    title: banner?.title ?? "",
    link_url: banner?.link_url ?? "",
    sort_order: banner?.sort_order ?? 0,
    published: banner?.published ?? false,
    image: null,
  })

  const previewFile = form.data.image
  const objectUrl = React.useMemo(
    () => (previewFile ? URL.createObjectURL(previewFile) : null),
    [previewFile],
  )

  React.useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const previewUrl = objectUrl ?? banner?.image_url ?? null

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (method === "put") {
      form.transform((data) => ({ ...data, _method: "put" }))
      form.post(submitUrl, {
        forceFormData: true,
        preserveScroll: true,
        onFinish: () => form.transform((data) => data),
      })
      return
    }
    form.post(submitUrl, { forceFormData: true, preserveScroll: true })
  }

  return (
    <AdminLayout
      title={isEdit ? "Edit Promo Toko" : "Tambah Promo Toko"}
      description="Slide manual beranda (cms_banners): judul, gambar, link, urutan, status published."
      actions={
        <Button asChild variant="secondary">
          <Link href={indexHref}>
            <Icon name="arrow-left" className="size-4" aria-hidden="true" />
            Kembali
          </Link>
        </Button>
      }
    >
      <Head title={`${isEdit ? "Edit" : "Tambah"} Promo Toko | Admin`} />

      <form onSubmit={onSubmit} className="mx-auto grid max-w-3xl gap-6">
        <FormErrorSummary errors={form.errors} />

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Stripe media: thumbnail kiri, upload inline kanan */}
          <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-start">
            <div className="h-32 w-24 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
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
                label="Upload gambar"
                error={form.errors.image}
                hint="Kartu homepage memakai rasio 3:4. Tanpa upload, link produk aktif bisa mengisi gambar otomatis."
              >
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => form.setData("image", event.target.files?.[0] ?? null)}
                />
              </Field>
            </div>
          </div>

          {/* Field informasi promo */}
          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
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
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-medium sm:self-end">
              <input
                type="checkbox"
                checked={form.data.published}
                onChange={(event) => form.setData("published", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Status aktif (published)
            </label>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : isEdit ? "Simpan perubahan" : "Tambah promo"}
          </Button>
          <Button asChild type="button" variant="secondary">
            <Link href={indexHref}>Batal</Link>
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
