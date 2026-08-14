import { Head, Link, useForm, usePage } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import AdminLayout from "@/layouts/admin-layout"
import type { SharedPageProps } from "@/types"

interface GalleryRecord {
  id: number
  label?: string | null
  image_url: string
  sort_order: number
  published: boolean
}

export default function GalleryForm({
  item,
  submitUrl,
  indexUrl,
  presignUrl,
}: {
  item: GalleryRecord | null
  submitUrl: string
  indexUrl: string
  presignUrl: string
}) {
  const editing = Boolean(item)
  const form = useForm({
    label: item?.label ?? "",
    image_url: item?.image_url ?? "",
    sort_order: item?.sort_order ?? 0,
    published: item?.published ?? true,
    object_key: "",
    upload: null as File | null,
  })
  const { csrf } = usePage<SharedPageProps>().props
  const [uploading, setUploading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [directError, setDirectError] = React.useState<string | null>(null)

  async function uploadDirect(file: File) {
    setUploading(true)
    setUploadProgress(0)
    setDirectError(null)
    try {
      const labelSlug =
        form.data.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
        "hasil-pemasangan"
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
          context: labelSlug,
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
      form.setData("image_url", "")
    } catch (error) {
      setDirectError(error instanceof Error ? error.message : "Upload gagal — coba lagi.")
      throw error
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  return (
    <AdminLayout
      title={editing ? "Edit ulasan foto" : "Tambah ulasan foto"}
      description="Foto hasil pemasangan untuk beranda dan halaman /reviews#hasil-pemasangan."
      actions={
        <Button asChild variant="secondary">
          <Link href={indexUrl}>Batal</Link>
        </Button>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Ulasan Foto | Admin`} />
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (form.data.upload) {
            try {
              await uploadDirect(form.data.upload)
            } catch {
              return
            }
          }
          if (editing) form.put(submitUrl)
          else form.post(submitUrl)
        }}
        className="mx-auto max-w-3xl space-y-6"
      >
        <FormErrorSummary errors={form.errors} />
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Stripe: thumbnail kiri, field inline kanan */}
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
            <div className="size-24 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
              {form.data.image_url ? (
                <img src={form.data.image_url} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground/60">
                  <span className="text-[10px]">Tanpa gambar</span>
                </div>
              )}
            </div>
            <div className="grid min-w-0 flex-1 gap-4">
              <Field id="gallery-label" label="Label" error={form.errors.label}>
                <Input
                  value={form.data.label}
                  onChange={(event) => form.setData("label", event.target.value)}
                  placeholder="Contoh: Pemasangan Bpk. Ahmad – Perumahan Kudus Indah"
                />
              </Field>
              <Field id="gallery-upload" label="Upload gambar" error={form.errors.upload}>
                <Input
                  id="gallery-upload"
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(event) => form.setData("upload", event.target.files?.[0] ?? null)}
                />
                {uploading ? (
                  <div className="mt-2" role="status" aria-live="polite">
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
                  <p role="alert" className="mt-2 text-xs leading-5 text-destructive">
                    {directError}
                  </p>
                ) : null}
              </Field>
              <Field id="gallery-image" label="…atau URL gambar" error={form.errors.image_url}>
                <Input
                  type="url"
                  value={form.data.image_url}
                  onChange={(event) => form.setData("image_url", event.target.value)}
                  placeholder="https://..."
                />
              </Field>
              <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
                <Field id="gallery-sort" label="Urutan" error={form.errors.sort_order} className="w-28">
                  <Input
                    type="number"
                    min="0"
                    value={form.data.sort_order}
                    onChange={(event) => form.setData("sort_order", Number(event.target.value))}
                  />
                </Field>
                <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.data.published}
                    onChange={(event) => form.setData("published", event.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  Tampilkan di storefront
                </label>
              </div>
            </div>
          </div>
        </section>
        <div className="flex justify-end gap-2">
          <Button asChild variant="secondary"><Link href={indexUrl}>Batal</Link></Button>
          <Button type="submit" disabled={uploading || form.processing}>
            {uploading
              ? `Mengunggah ${uploadProgress ?? 0}%...`
              : form.processing
                ? "Menyimpan..."
                : "Simpan foto"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
