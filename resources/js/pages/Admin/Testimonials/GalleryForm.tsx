import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { MediaPicker } from "@/components/admin/media-picker"
import { Button } from "@/components/admin/ui/button"
import { CheckboxField, Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"

interface GalleryRecord {
  id: number
  label?: string | null
  image_url: string
  sort_order: number
  published: boolean
}

export default function GalleryForm({
  item,
  nextSortOrder = 1,
  submitUrl,
  indexUrl,
  backUrl,
}: {
  item: GalleryRecord | null
  /** Nomor urut usulan untuk baris baru (selalu di bawah baris yang ada). */
  nextSortOrder?: number
  submitUrl: string
  indexUrl: string
  backUrl?: string | null
}) {
  const editing = Boolean(item)
  const form = useForm({
    label: item?.label ?? "",
    image_url: item?.image_url ?? "",
    sort_order: item?.sort_order ?? nextSortOrder,
    published: item?.published ?? true,
    object_key: "",
    media_asset_id: "",
  })
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [pickedPreview, setPickedPreview] = React.useState<string | null>(null)
  // Pratinjau memakai aset yang baru dipilih lebih dulu; sebelum ada pilihan
  // baru, nilainya dari gambar tersimpan.
  const previewSrc = pickedPreview ?? form.data.image_url

  return (
    <AdminLayout
      backUrl={backUrl}
      title={editing ? "Edit ulasan foto" : "Tambah ulasan foto"}
      description="Foto hasil pemasangan untuk beranda dan halaman /reviews#hasil-pemasangan."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="submit" form="testimonial-gallery-form" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan ulasan foto"}
          </Button>
          <Button asChild variant="secondary">
            <Link href={indexUrl}>Batal</Link>
          </Button>
        </div>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Ulasan Foto | Admin`} />
      <form
        id="testimonial-gallery-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (editing) form.put(submitUrl)
          else form.post(submitUrl)
        }}
        className="w-full space-y-5"
      >
        <FormErrorSummary errors={form.errors} />
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          {/* Stripe: thumbnail kiri, field inline kanan */}
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
            <div className="size-24 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
              {previewSrc ? (
                <img src={previewSrc} alt="" className="size-full object-cover" />
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
                  placeholder="Contoh: Pemasangan Bpk. Ahmad - Perumahan Kudus Indah"
                />
              </Field>
              <Field
                id="gallery-upload"
                label="Gambar dari Media Library"
                error={form.errors.media_asset_id}
                hint="Pilih aset dari Media Library. Unggah berkas baru di halaman Media Library."
              >
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex w-fit items-center gap-1.5"
                >
                  <Icon name="image" className="size-3.5" aria-hidden="true" />
                  <span>{form.data.media_asset_id ? "Ganti gambar" : "Pilih gambar"}</span>
                </Button>
              </Field>
              <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
                <Field
                  id="gallery-sort"
                  label="Urutan"
                  error={form.errors.sort_order}
                  className="w-28"
                  hint="Angka 1 tampil paling awal."
                >
                  <Input
                    type="number"
                    min="1"
                    value={form.data.sort_order}
                    onChange={(event) => form.setData("sort_order", Number(event.target.value))}
                  />
                </Field>
                <CheckboxField
                  id="gallery-published"
                  checked={form.data.published}
                  onChange={(checked) => form.setData("published", checked)}
                  label="Tampilkan di storefront"
                />
              </div>
            </div>
          </div>
        </section>
      </form>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        multiple={false}
        kind="image"
        title="Pilih Gambar Ulasan Foto"
        onPick={(picked) => {
          const asset = picked[0]
          if (!asset) return
          form.setData("media_asset_id", String(asset.assetId))
          setPickedPreview(asset.thumbUrl)
          setPickerOpen(false)
        }}
      />
    </AdminLayout>
  )
}
