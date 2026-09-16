import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker"
import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"

interface ModelProductOption {
  id: number
  name: string
  product_category?: string | null
  product_model?: string | null
}

interface FormProject {
  id: number
  title: string
  slug: string
  category_label?: string | null
  status: "active" | "inactive" | "archived"
  description?: string | null
  model_product_id?: number | null
  main_image_url?: string | null
  main_image_asset_id?: number | null
  main_video_url?: string | null
  main_video_asset_id?: number | null
  gallery_images?: Array<{ url: string; asset_id?: number | null; caption?: string | null }>
  specifications?: Array<{ name: string; value: string }>
  features?: string[]
}

interface FormProps {
  title: string
  project?: FormProject | null
  modelProducts: ModelProductOption[]
  submitUrl: string
  backUrl: string
}

export default function InstallationGalleryForm({
  title,
  project,
  modelProducts = [],
  submitUrl,
  backUrl,
}: FormProps) {
  const isEdit = Boolean(project?.id)

  const form = useForm({
    title: project?.title ?? "",
    category_label: project?.category_label ?? "",
    status: project?.status ?? "active",
    description: project?.description ?? "",
    model_product_id: project?.model_product_id ? String(project.model_product_id) : "",
    main_image_url: project?.main_image_url ?? "",
    main_image_asset_id: project?.main_image_asset_id ?? null,
    main_video_url: project?.main_video_url ?? "",
    main_video_asset_id: project?.main_video_asset_id ?? null,
    gallery_images: project?.gallery_images ?? [],
    specifications:
      project?.specifications && project.specifications.length > 0
        ? project.specifications
        : [
            { name: "Tipe Kaca", value: "" },
            { name: "Framer", value: "" },
            { name: "Warna", value: "" },
            { name: "Lokasi", value: "" },
          ],
    features:
      project?.features && project.features.length > 0
        ? project.features
        : [""],
  })

  // State MediaPicker
  const [pickerMode, setPickerMode] = React.useState<"main_image" | "main_video" | "gallery" | null>(null)

  function handleMainImagePick(picked: PickedMedia[]) {
    const first = picked[0]
    if (first) {
      form.setData({
        ...form.data,
        main_image_url: first.thumbUrl || first.videoUrl || "",
        main_image_asset_id: first.assetId,
      })
    }
    setPickerMode(null)
  }

  function handleMainVideoPick(picked: PickedMedia[]) {
    const first = picked[0]
    if (first) {
      form.setData({
        ...form.data,
        main_video_url: first.videoUrl || first.thumbUrl || "",
        main_video_asset_id: first.assetId,
      })
    }
    setPickerMode(null)
  }

  function handleGalleryPick(picked: PickedMedia[]) {
    const current = form.data.gallery_images ?? []
    const availableSlots = 3 - current.length
    if (availableSlots <= 0) {
      setPickerMode(null)
      return
    }

    const toAdd = picked.slice(0, availableSlots).map((p) => ({
      url: p.thumbUrl || "",
      asset_id: p.assetId,
      caption: p.label || "",
    }))

    form.setData("gallery_images", [...current, ...toAdd])
    setPickerMode(null)
  }

  function removeGalleryImage(index: number) {
    form.setData(
      "gallery_images",
      form.data.gallery_images.filter((_, i) => i !== index),
    )
  }

  // Spesifikasi Unit Dinamis
  function updateSpecification(index: number, key: "name" | "value", value: string) {
    const next = [...form.data.specifications]
    next[index] = { ...next[index], [key]: value }
    form.setData("specifications", next)
  }

  function addSpecificationRow() {
    form.setData("specifications", [...form.data.specifications, { name: "", value: "" }])
  }

  function removeSpecificationRow(index: number) {
    form.setData(
      "specifications",
      form.data.specifications.filter((_, i) => i !== index),
    )
  }

  // Fitur & Keunggulan Dinamis
  function updateFeature(index: number, value: string) {
    const next = [...form.data.features]
    next[index] = value
    form.setData("features", next)
  }

  function addFeatureRow() {
    form.setData("features", [...form.data.features, ""])
  }

  function removeFeatureRow(index: number) {
    form.setData(
      "features",
      form.data.features.filter((_, i) => i !== index),
    )
  }

  function handleSubmit(event: React.FormEvent, forceActive = false) {
    event.preventDefault()
    if (forceActive) {
      form.setData("status", "active")
    }

    if (isEdit) {
      form.put(submitUrl, { preserveScroll: true })
    } else {
      form.post(submitUrl, { preserveScroll: true })
    }
  }

  return (
    <AdminLayout
      title={title}
      description="Kelola portofolio instalasi proyek dengan informasi visual, spesifikasi unit, dan tautan katalog."
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href={backUrl}>Batal</Link>
          </Button>
          {!isEdit && (
            <Button
              type="button"
              variant="default"
              disabled={form.processing}
              onClick={(e) => handleSubmit(e, true)}
            >
              <Icon name="check" className="size-4" aria-hidden="true" />
              Simpan &amp; Terbitkan
            </Button>
          )}
          <Button
            type="submit"
            form="installation-project-form"
            disabled={form.processing}
          >
            {form.processing ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan"}
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <form
        id="installation-project-form"
        onSubmit={(e) => handleSubmit(e, false)}
        className="mx-auto max-w-4xl space-y-8"
      >
        <FormErrorSummary errors={form.errors} />

        {/* 1. INFORMASI DASAR */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="mb-5 flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">1. Informasi Dasar</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Judul utama portofolio, sub-judul kategori, dan status publikasi.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="title"
                label="Judul Proyek"
                required
                error={form.errors.title}
                description="Contoh: Kaca Mati Polos, Pintu Lipat Aluminium 4 Daun"
              >
                <Input
                  id="title"
                  value={form.data.title}
                  onChange={(e) => form.setData("title", e.target.value)}
                  placeholder="Masukkan judul proyek"
                  required
                />
              </Field>

              <Field
                id="category_label"
                label="Sub-judul atau Kategori"
                error={form.errors.category_label}
                description="Contoh: Timeless & Minimalis, Jendela & Kaca"
              >
                <Input
                  id="category_label"
                  value={form.data.category_label}
                  onChange={(e) => form.setData("category_label", e.target.value)}
                  placeholder="Masukkan sub-judul atau kategori"
                />
              </Field>
            </div>

            {/* Status Publikasi */}
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <label className="text-xs font-semibold text-foreground">Status Publikasi</label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Status publikasi menentukan apakah proyek langsung ditampilkan pada halaman publik toko.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { value: "active", label: "Aktif", desc: "Tampil di halaman publik" },
                  { value: "inactive", label: "Nonaktif", desc: "Disembunyikan sementara" },
                  { value: "archived", label: "Diarsipkan", desc: "Tidak lagi aktif" },
                ].map((s) => {
                  const isSelected = form.data.status === s.value
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => form.setData("status", s.value as any)}
                      className={cn(
                        "flex flex-col items-start rounded-lg border p-2.5 text-left text-xs transition",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      <span>{s.label}</span>
                      <span className="mt-0.5 text-[10px] opacity-80">{s.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 2. DESKRIPSI PROYEK */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="mb-5 border-b border-border pb-3">
            <h3 className="text-base font-semibold text-foreground">2. Deskripsi Proyek</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Jelaskan detail pekerjaan pemasangan, material yang digunakan, kondisi teknis, dan keunggulan.
            </p>
          </div>

          <Field
            id="description"
            label="Detail Deskripsi Pekerjaan"
            error={form.errors.description}
          >
            <Textarea
              id="description"
              rows={5}
              value={form.data.description}
              onChange={(e) => form.setData("description", e.target.value)}
              placeholder="Ceritakan detail pemasangan, tantangan di lokasi, solusi teknis yang diterapkan, dan material yang dipasang..."
            />
          </Field>
        </section>

        {/* 3. GALERI MEDIA */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="mb-5 border-b border-border pb-3">
            <h3 className="text-base font-semibold text-foreground">3. Galeri Media</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Dokumentasi visual proyek mencakup foto utama, video utama, serta hingga 3 foto tambahan. Format: JPG, PNG, MP4, MOV.
            </p>
          </div>

          <div className="space-y-6">
            {/* Foto Utama */}
            <div>
              <label className="text-xs font-semibold text-foreground">
                Foto Utama <span className="text-destructive">*</span>
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Foto utama digunakan sebagai visual utama (cover) proyek di halaman katalog &amp; daftar portofolio.
              </p>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative aspect-video w-full max-w-xs shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                  {form.data.main_image_url ? (
                    <img
                      src={form.data.main_image_url}
                      alt="Preview Foto Utama"
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center text-muted-foreground">
                      <Icon name="image" className="size-8" />
                      <span className="mt-1 text-[11px]">Belum ada foto utama</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPickerMode("main_image")}
                    >
                      <Icon name="image" className="size-3.5" />
                      Pilih dari Media Library
                    </Button>
                    {form.data.main_image_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          form.setData({
                            ...form.data,
                            main_image_url: "",
                            main_image_asset_id: null,
                          })
                        }
                      >
                        Hapus
                      </Button>
                    )}
                  </div>
                  <Input
                    type="url"
                    placeholder="Atau masukkan URL foto langsung..."
                    value={form.data.main_image_url}
                    onChange={(e) =>
                      form.setData({
                        ...form.data,
                        main_image_url: e.target.value,
                        main_image_asset_id: null,
                      })
                    }
                    className="text-xs"
                  />
                  {form.errors.main_image_url && (
                    <p className="text-[11px] text-destructive">{form.errors.main_image_url}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Video Utama */}
            <div className="border-t border-border pt-4">
              <label className="text-xs font-semibold text-foreground">Video Utama (Opsional)</label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Tampilkan rekaman video hasil pengerjaan atau ulasan di lapangan (MP4, WebM, MOV).
              </p>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative aspect-video w-full max-w-xs shrink-0 overflow-hidden rounded-lg border border-border bg-black">
                  {form.data.main_video_url ? (
                    <video
                      src={form.data.main_video_url}
                      controls
                      muted
                      preload="metadata"
                      className="size-full object-contain"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center text-muted-foreground bg-muted">
                      <Icon name="play" className="size-8" />
                      <span className="mt-1 text-[11px]">Tidak ada video</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPickerMode("main_video")}
                    >
                      <Icon name="video-camera" className="size-3.5" />
                      Pilih Video Library
                    </Button>
                    {form.data.main_video_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          form.setData({
                            ...form.data,
                            main_video_url: "",
                            main_video_asset_id: null,
                          })
                        }
                      >
                        Hapus
                      </Button>
                    )}
                  </div>
                  <Input
                    type="url"
                    placeholder="Atau URL video langsung (MP4/MOV)..."
                    value={form.data.main_video_url}
                    onChange={(e) =>
                      form.setData({
                        ...form.data,
                        main_video_url: e.target.value,
                        main_video_asset_id: null,
                      })
                    }
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Foto Tambahan (Hingga 3 Foto) */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Foto Tambahan (Maksimal 3 Foto)
                  </label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Sudut pandang atau detail pengerjaan lebih lengkap ({form.data.gallery_images.length}/3 foto).
                  </p>
                </div>
                {form.data.gallery_images.length < 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPickerMode("gallery")}
                  >
                    <Icon name="plus" className="size-3.5" />
                    Tambah Foto
                  </Button>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((slotIndex) => {
                  const image = form.data.gallery_images[slotIndex]
                  return (
                    <div
                      key={slotIndex}
                      className="relative flex aspect-4/3 flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30"
                    >
                      {image ? (
                        <>
                          <img
                            src={image.url}
                            alt={`Foto Tambahan ${slotIndex + 1}`}
                            className="size-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeGalleryImage(slotIndex)}
                            className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white hover:bg-destructive shadow-xs"
                            title="Hapus foto"
                          >
                            <Icon name="trash" className="size-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPickerMode("gallery")}
                          className="flex size-full flex-col items-center justify-center p-3 text-muted-foreground hover:bg-muted/60 transition"
                        >
                          <Icon name="image" className="size-6" />
                          <span className="mt-1 text-[11px] font-medium">
                            + Slot Foto {slotIndex + 1}
                          </span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 4. TAUTAN PRODUK KATALOG */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="mb-5 border-b border-border pb-3">
            <h3 className="text-base font-semibold text-foreground">4. Tautan Model Produk</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Hubungkan proyek pemasangan ini dengan model produk di katalog (misalnya <strong>Kaca Mati Standard</strong>) untuk membantu navigasi pelanggan.
            </p>
          </div>

          <Field
            id="model_product_id"
            label="Model Produk Terkait"
            error={form.errors.model_product_id}
            description="Pilih salah satu model produk katalog jika instalasi ini menggunakan produk tersebut."
          >
            <select
              id="model_product_id"
              value={form.data.model_product_id}
              onChange={(e) => form.setData("model_product_id", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— Tidak terikat produk tertentu (Umum/Lainnya) —</option>
              {modelProducts.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} {model.product_category ? `(${model.product_category})` : ""}
                </option>
              ))}
            </select>
          </Field>
        </section>

        {/* 5. SPESIFIKASI UNIT */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="mb-5 flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">5. Spesifikasi Unit</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Detail teknis instalasi dalam format nama dan nilai spesifikasi.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addSpecificationRow}>
              <Icon name="plus" className="size-3.5" />
              Tambah Baris
            </Button>
          </div>

          <div className="space-y-2.5">
            {form.data.specifications.map((row, index) => (
              <div key={index} className="grid grid-cols-[1fr_1.5fr_auto] items-center gap-2">
                <Input
                  value={row.name}
                  onChange={(e) => updateSpecification(index, "name", e.target.value)}
                  placeholder="Nama spesifikasi (mis. Tipe Kaca)"
                  className="text-xs"
                />
                <Input
                  value={row.value}
                  onChange={(e) => updateSpecification(index, "value", e.target.value)}
                  placeholder="Nilai spesifikasi (mis. Tempered 8mm)"
                  className="text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:bg-destructive/10"
                  onClick={() => removeSpecificationRow(index)}
                  title="Hapus baris spesifikasi"
                >
                  <Icon name="trash" className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* 6. FITUR DAN KEUNGGULAN */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="mb-5 flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">6. Fitur &amp; Keunggulan</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Manfaat atau nilai jual utama hasil pemasangan proyek ini (poin-poin bullet).
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addFeatureRow}>
              <Icon name="plus" className="size-3.5" />
              Tambah Poin
            </Button>
          </div>

          <div className="space-y-2.5">
            {form.data.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <Input
                  value={feature}
                  onChange={(e) => updateFeature(index, e.target.value)}
                  placeholder="Contoh: Tampilan bersih, Maksimal pencahayaan, Ketahanan material..."
                  className="text-xs flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:bg-destructive/10"
                  onClick={() => removeFeatureRow(index)}
                  title="Hapus poin keunggulan"
                >
                  <Icon name="trash" className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* FOOTER ACTIONS */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
          <Button asChild variant="outline">
            <Link href={backUrl}>Batal</Link>
          </Button>

          <div className="flex items-center gap-2">
            {!isEdit && (
              <Button
                type="button"
                variant="default"
                disabled={form.processing}
                onClick={(e) => handleSubmit(e, true)}
              >
                <Icon name="check" className="size-4" aria-hidden="true" />
                Simpan &amp; Terbitkan
              </Button>
            )}
            <Button type="submit" disabled={form.processing}>
              {form.processing ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </div>
        </div>
      </form>

      {/* MediaPicker Modal */}
      {pickerMode && (
        <MediaPicker
          open={Boolean(pickerMode)}
          onClose={() => setPickerMode(null)}
          multiple={pickerMode === "gallery"}
          title={
            pickerMode === "main_image"
              ? "Pilih Foto Utama Proyek"
              : pickerMode === "main_video"
                ? "Pilih Video Utama Proyek"
                : "Pilih Foto Tambahan Galeri"
          }
          onPick={(picked) => {
            if (pickerMode === "main_image") handleMainImagePick(picked)
            else if (pickerMode === "main_video") handleMainVideoPick(picked)
            else if (pickerMode === "gallery") handleGalleryPick(picked)
          }}
        />
      )}
    </AdminLayout>
  )
}
