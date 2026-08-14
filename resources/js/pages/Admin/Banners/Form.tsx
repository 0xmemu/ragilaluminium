import { Head, Link, useForm, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import AdminLayout from "@/layouts/admin-layout"
import type { SharedPageProps } from "@/types"

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
  presignUrl,
}: {
  banner: BannerFormData | null
  submitUrl: string
  method: "post" | "put"
  indexHref: string
  presignUrl: string
}) {
  const isEdit = Boolean(banner?.id)
  const form = useForm<{
    title: string
    link_url: string
    sort_order: number
    published: boolean
    image: File | null
    object_key: string
  }>({
    title: banner?.title ?? "",
    link_url: banner?.link_url ?? "",
    sort_order: banner?.sort_order ?? 0,
    published: banner?.published ?? false,
    image: null,
    object_key: "",
  })
  const { csrf } = usePage<SharedPageProps>().props
  const [uploading, setUploading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [directError, setDirectError] = React.useState<string | null>(null)

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

  async function uploadDirect(file: File) {
    setUploading(true)
    setUploadProgress(0)
    setDirectError(null)
    try {
      const presignRes = await fetch(presignUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRF-TOKEN": csrf,
        },
        body: JSON.stringify({
          kind: "image",
          filename: file.name,
          size_bytes: file.size,
          mime: file.type || "application/octet-stream",
          context: "banner",
        }),
      })
      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => null)
        throw new Error(body?.message ?? `Gagal menyiapkan upload (${presignRes.status})`)
      }
      const presigned = (await presignRes.json()) as { upload_url: string; object_key: string }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("PUT", presigned.upload_url)
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload ke penyimpanan gagal (${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error("Upload gagal — periksa koneksi internet."))
        xhr.send(file)
      })
      setUploadProgress(100)
      form.setData("object_key", presigned.object_key)
    } catch (error) {
      setDirectError(error instanceof Error ? error.message : "Upload gagal — coba lagi.")
      throw error
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (form.data.image) {
      try {
        await uploadDirect(form.data.image)
      } catch {
        return
      }
    }
    if (method === "put") {
      form.transform((data) => ({ ...data, _method: "put", image: null }))
      form.post(submitUrl, {
        forceFormData: true,
        preserveScroll: true,
        onFinish: () => form.transform((data) => data),
      })
      return
    }
    form.transform((data) => ({ ...data, image: null }))
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
      <Head title={`${isEdit ? "Edit" : "Tambah"} Banner Promo | Admin`} />

      <form onSubmit={onSubmit} className="mx-auto grid max-w-3xl gap-6">
        <FormErrorSummary errors={form.errors} />

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Stripe media: thumbnail kiri, upload inline kanan */}
          <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-start">
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
                label="Upload gambar"
                error={form.errors.image}
                hint="Satu gambar sumber dipakai untuk desktop & mobile. Layout banner paten 2,4:1 — siapkan canvas 2,4:1 (mis. 2048 × 852 px) agar tidak ter-crop. Gambar otomatis dikonversi WebP (pdp 1400px) agar landing page cepat. Tanpa upload, link produk aktif bisa mengisi gambar dari produk."
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
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
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
          <Button type="submit" disabled={uploading || form.processing}>
            {uploading
              ? `Mengunggah ${uploadProgress ?? 0}%...`
              : form.processing
                ? "Menyimpan..."
                : isEdit
                  ? "Simpan perubahan"
                  : "Tambah promo"}
          </Button>
          <Button asChild type="button" variant="secondary">
            <Link href={indexHref}>Batal</Link>
          </Button>
        </div>
        {uploading ? (
          <div role="status" aria-live="polite">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Upload langsung ke penyimpanan (R2)…</span>
              <span>{uploadProgress ?? 0}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${uploadProgress ?? 0}%` }}
              />
            </div>
          </div>
        ) : null}
        {directError ? (
          <p role="alert" className="text-xs leading-5 text-destructive">
            {directError}
          </p>
        ) : null}
      </form>
    </AdminLayout>
  )
}
