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
    model_product_id: project?.model_product_id ? String(project.model_product_id) : "",
    title: project?.title ?? "",
    category_label: project?.category_label ?? "",
    status: project?.status ?? "active",
    description: project?.description ?? "",
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
  })

  // State MediaPicker
  const [pickerMode, setPickerMode] = React.useState<"main_image" | "main_video" | "gallery" | null>(null)
  // State Pencarian Model
  const [modelQuery, setModelQuery] = React.useState("")

  const filteredModelProducts = React.useMemo(() => {
    if (!modelQuery.trim()) return modelProducts
    const lower = modelQuery.toLowerCase()
    return modelProducts.filter(
      (m) =>
        m.name.toLowerCase().includes(lower) ||
        (m.product_category && m.product_category.toLowerCase().includes(lower)) ||
        (m.product_model && m.product_model.toLowerCase().includes(lower)),
    )
  }, [modelProducts, modelQuery])

  const selectedModelInfo = React.useMemo(() => {
    return modelProducts.find((m) => String(m.id) === form.data.model_product_id)
  }, [modelProducts, form.data.model_product_id])

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

        {/* 1. TAUTAN MODEL PRODUK (TAMPIL PERTAMA DENGAN PENCARIAN DI SAMPING) */}
        <section className="rounded-xl border border-primary/30 bg-card p-5 shadow-xs sm:p-6 ring-1 ring-primary/20">
          <div className="mb-5 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                1
              </span>
              <h3 className="text-base font-semibold text-foreground">Tautan Model Produk</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pilih model produk di katalog yang menjadi dasar dokumentasi hasil pemasangan ini (misalnya <strong>Jendela Swing Satu Daun</strong>).
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Kolom Pencarian Cepat Model di Samping Dropdown */}
              <div>
                <label className="text-[13px] font-medium text-foreground">
                  Cari Model Produk
                </label>
                <div className="relative mt-1.5">
                  <Input
                    type="search"
                    value={modelQuery}
                    onChange={(e) => setModelQuery(e.target.value)}
                    placeholder="Ketik nama model (mis. Swing, Jungkit)..."
                    className="pl-8 pr-7 text-xs"
                  />
                  <Icon
                    name="search"
                    className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {modelQuery && (
                    <button
                      type="button"
                      onClick={() => setModelQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Bersihkan pencarian model"
                    >
                      <Icon name="x" className="size-3" />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {modelQuery
                    ? `Menemukan ${filteredModelProducts.length} model cocok.`
                    : "Ketik kata kunci untuk menyaring opsi pilihan model di samping."}
                </p>
              </div>

              {/* Dropdown Pilihan Model Produk */}
              <div>
                <label htmlFor="model_product_id" className="text-[13px] font-medium text-foreground">
                  Pilih Model Produk Katalog ({filteredModelProducts.length} model)
                </label>
                <select
                  id="model_product_id"
                  value={form.data.model_product_id}
                  onChange={(e) => {
                    const val = e.target.value
                    const selectedModel = modelProducts.find((m) => String(m.id) === val)
                    if (selectedModel && !form.data.title) {
                      form.setData({
                        ...form.data,
                        model_product_id: val,
                        title: selectedModel.name,
                        category_label:
                          selectedModel.product_category === "BOVEN"
                            ? "Boven & Ventilasi"
                            : "Jendela & Kaca",
                      })
                    } else {
                      form.setData("model_product_id", val)
                    }
                  }}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">— Tidak terikat produk tertentu (Umum/Lainnya) —</option>
                  {filteredModelProducts.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} {model.product_category ? `(${model.product_category})` : ""}
                    </option>
                  ))}
                </select>
                {form.errors.model_product_id && (
                  <p className="mt-1 text-[11px] text-destructive">{form.errors.model_product_id}</p>
                )}
              </div>
            </div>

            {/* Badge Model Terpilih */}
            {selectedModelInfo && (
              <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <Icon name="layers" className="size-4 text-primary" />
                  <span>
                    Model terpilih: <strong>{selectedModelInfo.name}</strong>{" "}
                    <span className="text-muted-foreground">({selectedModelInfo.product_category})</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => form.setData("model_product_id", "")}
                  className="text-xs text-muted-foreground hover:text-destructive underline"
                >
                  Lepas tautan
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 2. INFORMASI DASAR */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="mb-5 flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
                2
              </span>
              <div>
                <h3 className="text-base font-semibold text-foreground">Informasi Dasar</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Judul utama portofolio, sub-judul kategori, dan status publikasi.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="title"
                label="Judul Proyek"
                required
                error={form.errors.title}
                description="Contoh: Kaca Mati Polos, Jendela Swing Satu Daun"
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

        {/* 3. GALERI MEDIA */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="mb-5 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
                3
              </span>
              <div>
                <h3 className="text-base font-semibold text-foreground">Galeri Media</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Dokumentasi visual proyek mencakup foto utama, video utama, serta hingga 3 foto tambahan. Format: JPG, PNG, MP4, MOV.
                </p>
              </div>
            </div>
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

        {/* 4. DESKRIPSI PROYEK */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="mb-5 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
                4
              </span>
              <div>
                <h3 className="text-base font-semibold text-foreground">Deskripsi Proyek</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Jelaskan detail pekerjaan pemasangan, material yang digunakan, kondisi teknis, dan keunggulan.
                </p>
              </div>
            </div>
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

        {/* 5. SPESIFIKASI UNIT */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="mb-5 flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
                5
              </span>
              <div>
                <h3 className="text-base font-semibold text-foreground">Spesifikasi Unit</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Detail teknis instalasi dalam format nama dan nilai spesifikasi.
                </p>
              </div>
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
