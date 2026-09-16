import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker"
import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { SearchSelect } from "@/components/admin/ui/search-select"
import { Select } from "@/components/admin/ui/select"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"

interface ProductOption {
  value: string
  label: string
}

interface ModelProductOption {
  value: string
  label: string
  products?: ProductOption[]
}

interface FormProject {
  id: number
  title: string
  slug: string
  category_label?: string | null
  status: "active" | "inactive" | "archived"
  description?: string | null
  model_product_id?: number | null
  product_id?: number | null
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
  const editing = Boolean(project?.id)

  // Mode penempatan: "model" (di model produk katalog) atau "standalone" (mandiri).
  const [placementMode, setPlacementMode] = React.useState<"model" | "standalone">(
    project ? (project.model_product_id ? "model" : "standalone") : "model",
  )
  // Scope di dalam model: "product" (terikat SKU) atau "general" (umum model).
  const [modelScope, setModelScope] = React.useState<"product" | "general">(
    project?.product_id ? "product" : "general",
  )

  const form = useForm({
    model_product_id: project?.model_product_id ? String(project.model_product_id) : "",
    product_id: project?.product_id ? String(project.product_id) : "",
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
        : [{ name: "", value: "" }],
  })

  const [picker, setPicker] = React.useState<"main" | "video" | "gallery" | null>(null)

  const selectedModel = React.useMemo(
    () => (placementMode === "model" ? modelProducts.find((m) => m.value === form.data.model_product_id) : undefined),
    [modelProducts, form.data.model_product_id, placementMode],
  )

  const productOptions = React.useMemo<ProductOption[]>(
    () =>
      (selectedModel?.products ?? []).map((p) => ({
        value: String(p.id),
        label: `[${p.parent_sku}] ${p.name}`,
      })),
    [selectedModel],
  )

  const selectedProduct = React.useMemo(
    () =>
      modelScope === "product"
        ? productOptions.find((p) => p.value === form.data.product_id)
        : undefined,
    [productOptions, form.data.product_id, modelScope],
  )

  const isProductLinked = placementMode === "model" && modelScope === "product" && Boolean(selectedProduct)
  const isModelGeneral = placementMode === "model" && modelScope === "general"
  const isStandalone = placementMode === "standalone"

  const [galleryMedia, setGalleryMedia] = React.useState<PickedMedia[]>(
    (project?.gallery_images ?? []).map((g, i) => ({
      assetId: g.asset_id ?? -1 - i,
      label: g.caption ?? "",
      thumbUrl: g.url,
      kind: "image" as const,
      videoUrl: null,
    })),
  )

  React.useEffect(() => {
    form.setData(
      "gallery_images",
      galleryMedia.map((g) => ({ url: g.thumbUrl, asset_id: g.assetId > 0 ? g.assetId : null, caption: g.label })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryMedia])

  function applyMain(picked: PickedMedia | null) {
    form.setData({
      ...form.data,
      main_image_url: picked?.thumbUrl ?? "",
      main_image_asset_id: picked?.assetId ?? null,
    })
  }

  function moveGallery(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= galleryMedia.length) return
    const next = [...galleryMedia]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    setGalleryMedia(next)
  }

  function updateSpec(index: number, key: "name" | "value", value: string) {
    const next = form.data.specifications.map((row, i) => (i === index ? { ...row, [key]: value } : row))
    form.setData("specifications", next)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (editing) form.put(submitUrl)
    else form.post(submitUrl)
  }

  const mainPreview = form.data.main_image_url || ""

  return (
    <AdminLayout
      backUrl={backUrl}
      title={editing ? "Edit hasil pemasangan" : "Tambah hasil pemasangan"}
      description="Kelola dokumentasi hasil pemasangan sesuai hierarki storefront: model produk, produk katalog, atau portofolio mandiri."
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={backUrl}>Batal</Link>
          </Button>
          <Button type="submit" form="installation-project-form" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : editing ? "Simpan perubahan" : "Tambah hasil pemasangan"}
          </Button>
        </div>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Hasil Pemasangan | Admin`} />
      <form id="installation-project-form" className="w-full space-y-5" onSubmit={submit}>
        <FormErrorSummary errors={form.errors} />

        {/* Penempatan: model produk vs portofolio mandiri */}
        <SectionCard
          title="Penempatan hasil pemasangan"
          description="Tentukan di mana media ini tampil di storefront."
          icon="layers"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setPlacementMode("model")
                if (!form.data.model_product_id && modelProducts[0]) {
                  form.setData("model_product_id", modelProducts[0].value)
                }
              }}
              className={cn(
                "flex items-start gap-2.5 rounded-md border p-3 text-left transition",
                placementMode === "model"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-surface-muted",
              )}
            >
              <span className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                placementMode === "model" ? "border-primary bg-primary" : "border-input",
              )}>
                {placementMode === "model" ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-foreground">
                  Di halaman model produk
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Tampil di /hasil-pemasangan/[kategori]/[model] bersama produk model itu.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPlacementMode("standalone")
                form.setData({ ...form.data, model_product_id: "", product_id: "" })
              }}
              className={cn(
                "flex items-start gap-2.5 rounded-md border p-3 text-left transition",
                placementMode === "standalone"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-surface-muted",
              )}
            >
              <span className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                placementMode === "standalone" ? "border-primary bg-primary" : "border-input",
              )}>
                {placementMode === "standalone" ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-foreground">
                  Portofolio mandiri
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Tampil di halaman utama /hasil-pemasangan selevel kartu model (grup Lainnya).
                </span>
              </span>
            </button>
          </div>

          {placementMode === "model" ? (
            <div className="mt-4 space-y-4 rounded-md border border-border bg-surface/50 p-4">
              {/* Pilih model produk */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="model_product_id" className="text-[13px] font-medium text-foreground">
                    Model produk <span className="text-destructive">*</span>
                  </label>
                  <SearchSelect
                    id="model_product_id"
                    options={modelProducts.map((m) => ({ value: m.value, label: m.label }))}
                    value={form.data.model_product_id}
                    onValueChange={(value) => {
                      const mod = modelProducts.find((m) => m.value === value)
                      form.setData({
                        ...form.data,
                        model_product_id: value,
                        product_id: "",
                        title: mod ? mod.label.replace(/\s*\([^)]*\)\s*$/, "") : "",
                      })
                    }}
                    placeholder="Pilih model"
                    searchPlaceholder="Cari model"
                    emptyMessage="Model tidak ditemukan."
                    error={form.errors.model_product_id}
                    className="mt-1 w-72"
                  />
                </div>
              </div>

              {/* Scope: terikat SKU atau umum */}
              {selectedModel ? (
                <div className="border-t border-border pt-3">
                  <label className="text-[13px] font-medium text-foreground">
                    Tautan produk katalog
                  </label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Tautkan ke satu SKU agar foto juga tampil di halaman produk itu, atau biarkan umum untuk dokumentasi model.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setModelScope("general")}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-medium transition",
                        modelScope === "general"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-surface-muted",
                      )}
                    >
                      Umum (tanpa SKU)
                    </button>
                    <button
                      type="button"
                      onClick={() => setModelScope("product")}
                      disabled={productOptions.length === 0}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40",
                        modelScope === "product"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-surface-muted",
                      )}
                    >
                      Produk spesifik ({productOptions.length})
                    </button>
                  </div>

                  {modelScope === "product" ? (
                    <div className="mt-3">
                      <SearchSelect
                        id="product_id"
                        options={productOptions}
                        value={form.data.product_id}
                        onValueChange={(value) => form.setData("product_id", value)}
                        placeholder="Pilih produk / SKU"
                        searchPlaceholder="Cari SKU atau nama produk"
                        emptyMessage="Produk tidak ditemukan."
                        error={form.errors.product_id}
                        className="w-80"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </SectionCard>

        {/* Media hasil pemasangan */}
        <SectionCard
          title="Media hasil pemasangan"
          description="Foto utama wajib. Tambahkan video dan hingga 3 foto tambahan; ambil dari Media Library (otomatis WebP)."
          icon="image"
          action={
            <Button type="button" variant="secondary" size="sm" onClick={() => setPicker("main")}>
              <Icon name="upload" className="size-4" aria-hidden="true" />
              {mainPreview ? "Ganti foto utama" : "Pilih foto utama"}
            </Button>
          }
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            <div className="space-y-2">
              <div className="relative aspect-square w-full overflow-hidden rounded-md border border-border bg-surface-muted">
                {mainPreview ? (
                  <img src={mainPreview} alt="Pratinjau foto utama" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                    <Icon name="image" className="size-7" aria-hidden="true" />
                    <span className="text-[11px]">Belum ada foto utama</span>
                  </div>
                )}
              </div>
              {form.errors.main_image_url ? (
                <p className="text-xs text-destructive">{form.errors.main_image_url}</p>
              ) : null}
            </div>

            <div className="space-y-4">
              {/* Video utama */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold text-foreground">Video dokumentasi</h3>
                  <p className="text-xs text-muted-foreground">
                    {form.data.main_video_url ? "1 video terpasang." : "Opsional. MP4, WebM, atau MOV."}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {form.data.main_video_url ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => form.setData("main_video_url", "")}>
                      Lepas
                    </Button>
                  ) : null}
                  <Button type="button" variant="secondary" size="sm" onClick={() => setPicker("video")}>
                    <Icon name="video-camera" className="size-4" aria-hidden="true" />
                    {form.data.main_video_url ? "Ganti video" : "Pilih video"}
                  </Button>
                </div>
              </div>
              {form.data.main_video_url ? (
                <video
                  src={form.data.main_video_url}
                  controls
                  muted
                  preload="metadata"
                  className="aspect-video w-full max-w-sm rounded-md border border-border bg-black object-contain"
                />
              ) : null}

              {/* Foto tambahan */}
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold text-foreground">Foto tambahan</h3>
                  <p className="text-xs text-muted-foreground">
                    {galleryMedia.length} dari 3 foto. Urutan menentukan tampilan di galeri.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={galleryMedia.length >= 3}
                  onClick={() => setPicker("gallery")}
                >
                  <Icon name="plus" className="size-4" aria-hidden="true" />
                  Tambah foto
                </Button>
              </div>

              {galleryMedia.length === 0 ? (
                <div className="rounded-md border border-dashed border-border py-8 text-center">
                  <Icon name="images" className="mx-auto size-6 text-muted-foreground/70" aria-hidden="true" />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Belum ada foto tambahan.
                  </p>
                </div>
              ) : (
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                  {galleryMedia.map((item, index) => (
                    <li key={`${item.assetId}-${index}`} className="group relative">
                      <div className="relative aspect-square w-full overflow-hidden rounded-md border border-border bg-surface-muted">
                        {item.thumbUrl ? (
                          <img src={item.thumbUrl} alt={item.label || `Foto ${index + 1}`} className="size-full object-cover" />
                        ) : (
                          <span className="flex size-full items-center justify-center text-muted-foreground">
                            <Icon name="image" className="size-5" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveGallery(index, -1)}
                            disabled={index === 0}
                            className="rounded p-0.5 text-muted-foreground transition hover:text-foreground disabled:opacity-30"
                            aria-label={`Geser foto ${index + 1} ke kiri`}
                          >
                            <Icon name="caret-left" className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveGallery(index, 1)}
                            disabled={index === galleryMedia.length - 1}
                            className="rounded p-0.5 text-muted-foreground transition hover:text-foreground disabled:opacity-30"
                            aria-label={`Geser foto ${index + 1} ke kanan`}
                          >
                            <Icon name="caret-right" className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setGalleryMedia(galleryMedia.filter((_, i) => i !== index))}
                          className="rounded p-0.5 text-muted-foreground transition hover:text-destructive"
                          aria-label={`Hapus foto ${index + 1}`}
                        >
                          <Icon name="trash-2" className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Informasi dasar (table-first) */}
        <div className="rounded-lg border border-border">
          <table className="w-full">
            <tbody className="divide-y divide-border">
              {isProductLinked ? (
                <tr>
                  <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Produk terkait</th>
                  <td className="px-4 py-2.5">
                    <div className="rounded-md border border-border bg-surface-muted px-3 py-2">
                      <p className="text-[13px] font-medium text-foreground">{selectedProduct?.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Media tersimpan ke produk ini dan otomatis tampil di halaman model serta halaman produk di storefront.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                    Judul <span className="text-destructive">*</span>
                  </th>
                  <td className="px-4 py-2.5">
                    <Input
                      value={form.data.title}
                      onChange={(event) => form.setData("title", event.target.value)}
                      placeholder={isModelGeneral ? selectedModel?.label ?? "Judul dokumentasi" : "contoh: Pemasangan Partisi Kantor Kudus"}
                      className="h-8 w-72 text-xs"
                    />
                    {form.errors.title ? (
                      <p className="mt-1 text-xs text-destructive">{form.errors.title}</p>
                    ) : null}
                  </td>
                </tr>
              )}
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Keterangan pemasangan</th>
                <td className="px-4 py-2.5">
                  <Textarea
                    rows={2}
                    value={form.data.description ?? ""}
                    onChange={(event) => form.setData("description", event.target.value)}
                    placeholder="Catatan pengerjaan lapangan, material, atau lokasi (opsional)."
                    className="text-xs"
                  />
                  {form.errors.description ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.description}</p>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Status publikasi</th>
                <td className="px-4 py-2.5">
                  <Select
                    value={form.data.status}
                    onChange={(event) => form.setData("status", event.target.value)}
                    className="h-8 w-40 text-xs"
                  >
                    <option value="active">Aktif - tampil di toko</option>
                    <option value="inactive">Nonaktif - disembunyikan</option>
                    <option value="archived">Diarsipkan</option>
                  </Select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Spesifikasi unit: hanya untuk placement tanpa SKU spesifik */}
        {!isProductLinked ? (
          <SectionCard
            title="Spesifikasi unit"
            description="Baris nama-nilai detail teknis instalasi (opsional), mis. Tipe Kaca → Tempered 8mm."
            icon="ruler"
          >
            <div className="max-w-2xl space-y-2">
              {form.data.specifications.map((row, index) => (
                <div key={index} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
                  <Input
                    value={row.name}
                    onChange={(event) => updateSpec(index, "name", event.target.value)}
                    placeholder="Nama (mis. Tipe Kaca)"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={row.value}
                    onChange={(event) => updateSpec(index, "value", event.target.value)}
                    placeholder="Nilai (mis. Tempered 8mm)"
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => form.setData("specifications", form.data.specifications.filter((_, i) => i !== index))}
                  >
                    Hapus
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => form.setData("specifications", [...form.data.specifications, { name: "", value: "" }])}
              >
                <Icon name="plus" className="size-4" aria-hidden="true" />
                Tambah baris spesifikasi
              </Button>
            </div>
          </SectionCard>
        ) : null}
      </form>

      <MediaPicker
        open={picker === "main"}
        onClose={() => setPicker(null)}
        multiple={false}
        title="Foto utama hasil pemasangan"
        onPick={(picked) => {
          applyMain(picked[0] ?? null)
          setPicker(null)
        }}
      />
      <MediaPicker
        open={picker === "video"}
        onClose={() => setPicker(null)}
        multiple={false}
        title="Video dokumentasi pemasangan"
        onPick={(picked) => {
          const first = picked[0]
          form.setData("main_video_url", first?.videoUrl || first?.thumbUrl || "")
          setPicker(null)
        }}
      />
      <MediaPicker
        open={picker === "gallery"}
        onClose={() => setPicker(null)}
        multiple
        title="Foto tambahan hasil pemasangan"
        onPick={(picked) => {
          const seen = new Set(galleryMedia.map((item) => item.assetId))
          const next = [...galleryMedia]
          for (const item of picked) {
            if (!seen.has(item.assetId) && next.length < 3) next.push(item)
          }
          setGalleryMedia(next)
          setPicker(null)
        }}
      />
    </AdminLayout>
  )
}
