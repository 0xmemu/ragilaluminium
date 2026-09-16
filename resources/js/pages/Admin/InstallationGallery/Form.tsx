import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker"
import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { SearchSelect } from "@/components/admin/ui/search-select"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"

interface ProductOption {
  id: number
  name: string
  parent_sku: string
}

interface ModelProductOption {
  id: number
  name: string
  label: string
  category?: string | null
  model?: string | null
  products?: ProductOption[]
}

interface FormProps {
  title: string
  project?: null
  modelProducts: ModelProductOption[]
  submitUrl: string
  backUrl: string
}

const STANDALONE_OPTION = { value: "standalone", label: "Portofolio mandiri (tanpa model produk)" }
const UMUM_OPTION = { value: "", label: "Umum (tanpa SKU)" }

export default function InstallationGalleryForm({
  title,
  modelProducts = [],
  submitUrl,
  backUrl,
}: FormProps) {
  const form = useForm({
    model_product_id: "",
    product_id: "",
    description: "",
    main_image_url: "",
    main_image_asset_id: null as number | null,
    main_video_url: "",
    main_video_asset_id: null as number | null,
    gallery_images: [] as Array<{ url: string; asset_id: number | null; caption: string }>,
  })

  const [picker, setPicker] = React.useState<"main" | "video" | "gallery" | null>(null)

  const modelOptions = React.useMemo(
    () => modelProducts.map((m) => ({ value: String(m.id), label: m.label })),
    [modelProducts],
  )

  const selectedModel = React.useMemo(
    () => modelProducts.find((m) => String(m.id) === form.data.model_product_id),
    [modelProducts, form.data.model_product_id],
  )

  const productOptions = React.useMemo(
    () => [
      UMUM_OPTION,
      ...(selectedModel?.products ?? []).map((p) => ({
        value: String(p.id),
        label: `[${p.parent_sku}] ${p.name}`,
      })),
    ],
    [selectedModel],
  )

  const selectedProduct = React.useMemo(
    () => (selectedModel?.products ?? []).find((p) => String(p.id) === form.data.product_id),
    [selectedModel, form.data.product_id],
  )

  const isStandalone = form.data.model_product_id === STANDALONE_OPTION.value
  const isProductLinked = Boolean(selectedProduct)

  const [galleryMedia, setGalleryMedia] = React.useState<PickedMedia[]>([])

  React.useEffect(() => {
    form.setData(
      "gallery_images",
      galleryMedia.map((g) => ({
        url: g.thumbUrl,
        asset_id: g.assetId > 0 ? g.assetId : null,
        caption: g.label,
      })),
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

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.post(submitUrl)
  }

  const mainPreview = form.data.main_image_url || ""

  return (
    <AdminLayout
      backUrl={backUrl}
      title={title}
      description="Tambah media hasil pemasangan untuk model produk, produk katalog (SKU), atau portofolio mandiri."
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={backUrl}>Batal</Link>
          </Button>
          <Button type="submit" form="installation-project-form" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Tambah hasil pemasangan"}
          </Button>
        </div>
      }
    >
      <Head title={`Tambah Hasil Pemasangan | Admin`} />
      <form id="installation-project-form" className="w-full space-y-5" onSubmit={submit}>
        <FormErrorSummary errors={form.errors} />

        {/* Table-first: satu baris per field */}
        <div className="rounded-lg border border-border">
          <table className="w-full">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Penempatan <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant={!isStandalone ? "default" : "secondary"}
                      size="sm"
                      className={cn("h-8 text-xs", isStandalone && "opacity-60")}
                      onClick={() => {
                        if (isStandalone) {
                          const first = modelOptions[0]
                          form.setData({
                            ...form.data,
                            model_product_id: first ? first.value : "",
                            product_id: "",
                          })
                        }
                      }}
                      disabled={modelOptions.length === 0}
                    >
                      <Icon name="layers" className="size-3.5" aria-hidden="true" />
                      Gunakan model produk
                    </Button>
                    <Button
                      type="button"
                      variant={isStandalone ? "default" : "secondary"}
                      size="sm"
                      className={cn("h-8 text-xs", !isStandalone && "opacity-60")}
                      onClick={() => {
                        form.setData({
                          ...form.data,
                          model_product_id: STANDALONE_OPTION.value,
                          product_id: "",
                        })
                      }}
                    >
                      <Icon name="cube" className="size-3.5" aria-hidden="true" />
                      Buat grup baru
                    </Button>
                  </div>

                  {!isStandalone ? (
                    <div className="mt-2">
                      <SearchSelect
                        id="model_product_id"
                        options={modelOptions}
                        value={form.data.model_product_id}
                        onValueChange={(value) => {
                          form.setData({ ...form.data, model_product_id: value, product_id: "" })
                        }}
                        placeholder="Pilih model"
                        searchPlaceholder="Cari model"
                        emptyMessage="Model tidak ditemukan."
                        error={form.errors.model_product_id}
                        className="w-72"
                      />
                    </div>
                  ) : (
                    <div className="mt-2 rounded-md border border-border bg-surface-muted px-3 py-2">
                      <p className="text-[13px] font-medium text-foreground">Portofolio mandiri</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Grup independen di halaman /hasil-pemasangan, selevel kartu model (grup Lainnya).
                      </p>
                    </div>
                  )}
                </td>
              </tr>
              {!isStandalone ? (
                <tr>
                  <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                    Tautan produk katalog
                  </th>
                  <td className="px-4 py-2.5">
                    {selectedModel ? (
                      <>
                        <SearchSelect
                          id="product_id"
                          options={productOptions}
                          value={form.data.product_id}
                          onValueChange={(value) => form.setData("product_id", value)}
                          placeholder={UMUM_OPTION.label}
                          searchPlaceholder="Cari SKU atau nama produk"
                          emptyMessage="Produk tidak ditemukan."
                          error={form.errors.product_id}
                          className="w-80"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isProductLinked
                            ? "Media tampil di halaman model ini dan di halaman produk tersebut."
                            : "Biarkan Umum untuk media milik model saja, atau pilih SKU agar media juga tampil di halaman produknya."}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Pilih model produk dahulu.</p>
                    )}
                  </td>
                </tr>
              ) : null}
              {!isProductLinked ? (
                <tr>
                  <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                    Keterangan media
                  </th>
                  <td className="px-4 py-2.5">
                    <Textarea
                      rows={2}
                      value={form.data.description}
                      onChange={(event) => form.setData("description", event.target.value)}
                      placeholder={
                        isStandalone
                          ? "Judul proyek / keterangan hasil pemasangan (mis. Partisi kantor Kudus)."
                          : "Keterangan foto pemasangan (opsional)."
                      }
                      className="text-xs"
                    />
                    {form.errors.description ? (
                      <p className="mt-1 text-xs text-destructive">{form.errors.description}</p>
                    ) : null}
                  </td>
                </tr>
              ) : null}
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
              ) : null}
            </tbody>
          </table>
        </div>

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
