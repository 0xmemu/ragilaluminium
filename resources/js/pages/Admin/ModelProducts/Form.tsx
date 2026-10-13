import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { MediaPickerSheet, type PickedMedia } from "@/components/admin/media-picker-sheet"
import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { CheckboxField, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"
import { SubmitGateButton } from "@/components/admin/ui/submit-gate-button"
import { jagaGerbang } from "@/lib/submit-gate"

interface ModelRecord {
  id: number
  name: string
  product_category?: string | null
  product_model?: string | null
  image_url?: string | null
  description?: string | null
  keywords?: string[]
  status: string
  sort_order: number
  media_show_product_photos?: boolean
}

interface ModelStats {
  active_count: number
  archived_count: number
  variant_count: number
  designs: string[]
}

// Template label pill (kontrak owner 2026-09-02: maksimal 2 kata).
// Admin pilih dari daftar ini saat mengisi kata kunci; input manual tetap
// bisa selama tidak lebih dari 2 kata.
const PILL_PRESETS: string[] = [
  "Tahan Air",
  "Anti Debu",
  "Kaca Kuat",
  "Hemat Ruang",
  "Gerak Ringan",
  "Klasik Elegan",
  "Ventilasi Penuh",
  "Mudah Dirawat",
  "Sirkulasi Baik",
  "Buka Penuh",
  "Sirkulasi Optimal",
  "Anti Basah",
  "Rapi Modern",
  "Bukaan Lebar",
  "Bukaan Samping",
  "Privasi Terjaga",
  "Cahaya Maksimal",
  "Tampilan Modern",
  "Kedap Debu",
  "Garansi Penuh",
]

function wordCount(value: string): number {
  return value.trim().length === 0 ? 0 : value.trim().split(/\s+/).length
}

export default function ModelProductForm({
  modelProduct,
  media,
  gallery,
  maxGallery = 8,
  stats,
  storefrontUrl,
  productsUrl,
  statuses,
  categories,
  defaultHighlights = [],
  submitUrl,
  indexUrl,
  backUrl,
}: {
  modelProduct: ModelRecord | null
  media?: PickedMedia | null
  gallery?: PickedMedia[]
  maxGallery?: number
  stats?: ModelStats | null
  storefrontUrl?: string | null
  productsUrl?: string | null
  statuses: string[]
  categories: Array<{ value: string; label: string }>
  /** Pill bawaan sistem saat kata kunci admin kosong (fallback storefront). */
  defaultHighlights?: string[]
  submitUrl: string
  indexUrl: string
  backUrl?: string | null
}) {
  const editing = Boolean(modelProduct)
  const form = useForm({
    name: modelProduct?.name ?? "",
    product_category: modelProduct?.product_category ?? "",
    image_url: modelProduct?.image_url ?? "",
    media_asset_id: media?.assetId ?? null,
    gallery_asset_ids: (gallery ?? []).map((item) => item.assetId),
    media_show_product_photos: modelProduct?.media_show_product_photos ?? true,
    description: modelProduct?.description ?? "",
    keywords: modelProduct?.keywords ?? [],
    status: modelProduct?.status ?? "draft",
  })

  // Galeri dikelola lokal lalu dikirim sebagai daftar id terurut; server
  // menyimpan urutannya, sehingga urutan di sini = urutan hero storefront.
  const [mainMedia, setMainMedia] = React.useState<PickedMedia | null>(media ?? null)
  const [galleryMedia, setGalleryMedia] = React.useState<PickedMedia[]>(gallery ?? [])

  // Sinkron dari snapshot server HANYA saat isinya benar-benar berubah:
  // Inertia mengirim array baru pada setiap re-render (termasuk setelah
  // validasi gagal), jadi perbandingan identitas akan menghapus pilihan
  // galeri yang baru saja dibuat admin.
  const gallerySignature = (gallery ?? []).map((item) => item.assetId).join(",")
  const appliedSignature = React.useRef(gallerySignature)

  React.useEffect(() => {
    if (appliedSignature.current === gallerySignature) return
    appliedSignature.current = gallerySignature
    setGalleryMedia(gallery ?? [])
    form.setData("gallery_asset_ids", (gallery ?? []).map((item) => item.assetId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gallerySignature])

  function applyMain(picked: PickedMedia | null) {
    setMainMedia(picked)
    form.setData("media_asset_id", picked?.assetId ?? null)
    if (!picked) form.setData("image_url", "")
  }

  function applyGallery(next: PickedMedia[]) {
    setGalleryMedia(next)
    form.setData("gallery_asset_ids", next.map((item) => item.assetId))
  }

  // Dipakai dua pemicu galeri (kontainer kosong dan ubin tambah), jadi satu fungsi.
  function tambahGaleri(picked: PickedMedia[]) {
    // Galeri tidak boleh memuat gambar utama dua kali.
    const seen = new Set(galleryMedia.map((item) => item.assetId))
    const next = [...galleryMedia]
    for (const item of picked) {
      if (seen.has(item.assetId) || item.assetId === mainMedia?.assetId) continue
      if (next.length >= maxGallery) break
      seen.add(item.assetId)
      next.push(item)
    }
    applyGallery(next)
  }

  function moveGallery(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= galleryMedia.length) return
    const next = [...galleryMedia]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    applyGallery(next)
  }

  // Gerbang isi (kontrak "logika tombol"): tiga kolom wajibnya mengikuti aturan
  // `required` ModelProductController. Kolom lain (kata kunci, deskripsi, media)
  // tidak ikut dikunci karena server memang tidak mewajibkannya.
  const gerbang = {
    fields: {
      name: "Nama Model Produk",
      product_category: "Kategori katalog",
      status: "Status",
    },
    requireChange: editing,
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (editing) form.put(submitUrl)
    else form.post(submitUrl)
  }

  const mainPreview = mainMedia?.thumbUrl || form.data.image_url || ""

  return (
    <AdminLayout
      backUrl={backUrl}
      title={editing ? "Edit model produk" : "Tambah model produk"}
      description="Buat dan atur tampilan model produk di storefront."
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={indexUrl}>Batal</Link>
          </Button>
          <SubmitGateButton
            form={form} {...gerbang}
            formId="model-product-form"
            label="Simpan model"
            processing={form.processing}
          />
        </div>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Model Produk | Admin`} />
      <form id="model-product-form" className="w-full space-y-5" onSubmit={jagaGerbang(gerbang, form, submit)}>
        <FormErrorSummary errors={form.errors} />

        <div className="rounded-lg border border-border">
          <table className="w-full">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Nama Model Produk <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <Input value={form.data.name} onChange={(event) => form.setData("name", event.target.value)} className="h-8 text-xs" />
                  {form.errors.name ? <p className="mt-1 text-xs text-destructive">{form.errors.name}</p> : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Kategori katalog <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <Select
                    value={form.data.product_category}
                    onChange={(event) => form.setData("product_category", event.target.value)}
                    className="h-8 w-72 text-xs"
                  >
                    <option value="">Pilih kategori</option>
                    {categories.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                  {form.errors.product_category ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.product_category}</p>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Status <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <Select value={form.data.status} onChange={(event) => form.setData("status", event.target.value)} className="h-8 w-48 text-xs">
                    {statuses.map((status) => (
                      <option key={status} value={status}>{status === "draft" ? "Nonaktif" : "Aktif"}</option>
                    ))}
                  </Select>
                  {form.errors.status ? <p className="mt-1 text-xs text-destructive">{form.errors.status}</p> : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Deskripsi model</th>
                <td className="px-4 py-2.5">
                  <Textarea
                    rows={3}
                    value={form.data.description}
                    onChange={(event) => form.setData("description", event.target.value)}
                    className="text-xs"
                    placeholder="Contoh: Jendela sliding cocok untuk ruangan dengan bukaan lebar."
                  />
                  {form.errors.description ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.description}</p>
                  ) : null}
                </td>
              </tr>

            </tbody>
          </table>
        </div>

        <SectionCard
          title="Kata kunci pill"
          description="Tiap baris menjadi satu pill di hero halaman detail model."
          icon="sparkle"
        >
          <div className="max-w-2xl space-y-2">
            {form.data.keywords.map((keyword, index) => {
              const over = wordCount(keyword) > 2
              return (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    className="h-8 w-44 shrink-0 text-xs"
                    value=""
                    onChange={(event) => {
                      if (!event.target.value) return
                      const next = form.data.keywords.map((item, i) =>
                        i === index ? event.target.value : item,
                      )
                      form.setData("keywords", next)
                    }}
                    aria-label={`Pilih template label ${index + 1}`}
                  >
                    <option value="">Template...</option>
                    {PILL_PRESETS.filter((preset) => !form.data.keywords.includes(preset) || preset === keyword).map((preset) => (
                      <option key={preset} value={preset}>{preset}</option>
                    ))}
                  </Select>
                  <Input
                    className={cn("h-8 min-w-0 flex-1 text-xs", over && "border-destructive")}
                    value={form.data.keywords[index]}
                    onChange={(event) => {
                      const next = form.data.keywords.map((item, i) =>
                        i === index ? event.target.value : item,
                      )
                      form.setData("keywords", next)
                    }}
                    placeholder={`Label ${index + 1}, maks 2 kata`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="size-8 shrink-0 px-0"
                    disabled={form.data.keywords.length <= 1}
                    onClick={() => form.setData("keywords", form.data.keywords.filter((_, i) => i !== index))}
                    aria-label={`Hapus kata kunci ${index + 1}`}
                  >
                    <Icon name="trash-2" className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              )
            })}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={form.data.keywords.length >= 6}
              onClick={() => form.setData("keywords", [...form.data.keywords, ""])}
            >
              <Icon name="plus" className="size-4" aria-hidden="true" />
              Tambah
            </Button>
          </div>
          {form.errors.keywords ? (
            <p className="mt-2 text-xs text-destructive">{form.errors.keywords}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Pilih dari template atau tulis sendiri, maksimal 2 kata per pill dan maksimal 6 pill.
          </p>

          {(() => {
            // Pill yang benar-benar tampil di storefront: isi admin bila ada,
            // selain itu bawaan sistem. Kosong di kedua sumber = tidak ada pill.
            const activeLabels = form.data.keywords.map((k) => k.trim()).filter(Boolean)
            const isDefault = activeLabels.length === 0
            const previewLabels = isDefault ? defaultHighlights : activeLabels

            return (
              <div className="mt-4 rounded-md border border-dashed border-border bg-surface/50 p-3">
                <p className="text-[11px] font-semibold tracking-tight text-muted-foreground">
                  Pill yang tampil di toko
                </p>
                {previewLabels.length ? (
                  <>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {previewLabels.map((label, index) => (
                        <span
                          key={`${label}-${index}`}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
                            isDefault
                              ? "border border-border bg-card text-muted-foreground"
                              : "bg-secondary text-secondary-foreground",
                          )}
                        >
                          <Icon name="sparkle" className="size-3" aria-hidden="true" />
                          {label}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                      {isDefault
                        ? "Kata kunci admin kosong, jadi toko memakai pill bawaan sistem (yang berwarna abu). Isi kata kunci untuk menimpanya."
                        : "Diambil dari kata kunci yang Anda isi, urut sesuai daftar."}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Belum ada pill yang tampil. Isi kata kunci atau pilih template di atas.
                  </p>
                )}
              </div>
            )
          })()}
        </SectionCard>

        <SectionCard
          title="Media model"
          icon="image"
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            <div className="space-y-2">
              <MediaPickerSheet
                title="Gambar utama model"
                onPick={(picked) => applyMain(picked[0] ?? null)}
                trigger={(open) => (
                  <button
                    type="button"
                    onClick={open}
                    aria-label={mainPreview ? "Ganti gambar utama" : "Pilih gambar utama"}
                    className="group relative block aspect-square w-full cursor-pointer overflow-hidden rounded-md border border-border bg-surface-muted transition hover:border-primary"
                  >
                    {mainPreview ? (
                      <>
                        <img src={mainPreview} alt="Pratinjau gambar utama" className="size-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-medium text-transparent transition group-hover:bg-black/40 group-hover:text-white">
                          Ganti gambar
                        </span>
                      </>
                    ) : (
                      <span className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                        <Icon name="image" className="size-7" aria-hidden="true" />
                        <span className="text-[11px]">Klik untuk pilih gambar utama</span>
                      </span>
                    )}
                  </button>
                )}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-muted-foreground">
                  {mainMedia?.label || (mainPreview ? "Gambar lama (URL)" : "Kosong")}
                </span>
                {mainMedia || mainPreview ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => applyMain(null)}>
                    Lepas
                  </Button>
                ) : null}
              </div>
              {form.errors.media_asset_id ? (
                <p className="text-xs text-destructive">{form.errors.media_asset_id}</p>
              ) : null}
              {form.errors.image_url ? (
                <p className="text-xs text-destructive">{form.errors.image_url}</p>
              ) : null}
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-[13px] font-semibold text-foreground">Galeri foto model</h3>
                <p className="text-xs text-muted-foreground">
                  {galleryMedia.length} dari {maxGallery} foto. Urutan menentukan tampilan di hero.
                </p>
              </div>

              {galleryMedia.length === 0 ? (
                <MediaPickerSheet
                  title="Galeri foto model"
                  multiple
                  onPick={tambahGaleri}
                  trigger={(open) => (
                    <button
                      type="button"
                      onClick={open}
                      aria-label="Pilih foto galeri dari Media Library"
                      className="w-full cursor-pointer rounded-md border border-dashed border-border py-8 text-center transition hover:border-primary"
                    >
                      <Icon name="images" className="mx-auto size-6 text-muted-foreground/70" aria-hidden="true" />
                      <span className="mt-1.5 block text-xs text-muted-foreground">
                        Belum ada foto galeri. Klik untuk memilih dari Media Library.
                      </span>
                    </button>
                  )}
                />
              ) : (
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                  {galleryMedia.map((item, index) => (
                    <li key={item.assetId} className="group relative">
                      <div className="relative aspect-square w-full overflow-hidden rounded-md border border-border bg-surface-muted">
                        {item.thumbUrl ? (
                          <img src={item.thumbUrl} alt={item.label || `Foto ${index + 1}`} className="size-full object-cover" />
                        ) : (
                          <span className="flex size-full items-center justify-center text-muted-foreground">
                            <Icon name="image" className="size-5" aria-hidden="true" />
                          </span>
                        )}
                        {index === 0 ? (
                          <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
                            Pertama
                          </span>
                        ) : null}
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
                          onClick={() => applyGallery(galleryMedia.filter((_, i) => i !== index))}
                          className="rounded p-0.5 text-muted-foreground transition hover:text-destructive"
                          aria-label={`Hapus foto ${index + 1}`}
                        >
                          <Icon name="trash-2" className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                  {galleryMedia.length < maxGallery ? (
                    <li>
                      <MediaPickerSheet
                        title="Galeri foto model"
                        multiple
                        onPick={tambahGaleri}
                        trigger={(open) => (
                          <button
                            type="button"
                            onClick={open}
                            aria-label="Tambah foto galeri dari Media Library"
                            className="flex aspect-square w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-foreground"
                          >
                            <Icon name="plus" className="size-5" aria-hidden="true" />
                          </button>
                        )}
                      />
                    </li>
                  ) : null}
                </ul>
              )}
              {form.errors.gallery_asset_ids ? (
                <p className="text-xs text-destructive">{form.errors.gallery_asset_ids}</p>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Setelan tampilan media"
          description="Atur sumber foto yang tampil di hero halaman detail model."
          icon="sliders"
        >
          <div className="space-y-3">
            <CheckboxField
              id="model-show-product-photos"
              checked={Boolean(form.data.media_show_product_photos)}
              onChange={(checked) => form.setData("media_show_product_photos", checked)}
              standalone
              label={
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-foreground">
                    Sertakan foto produk di hero model
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Bila dimatikan, hero hanya memakai gambar utama dan galeri model sehingga tampilan
                    lebih rapi saat foto produk belum seragam.
                  </span>
                </span>
              }
            />
            <p className="text-xs text-muted-foreground">
              Jumlah foto di hero dibatasi 12 supaya halaman tetap ringan; urutan diambil dari
              gambar utama, lalu galeri model, baru foto produk.
            </p>
          </div>
        </SectionCard>

        {editing ? (
          <SectionCard
            title="Isi wadah model ini"
            description="Ringkasan produk yang memakai kategori dan model ini."
            icon="cube"
            action={
              productsUrl ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={productsUrl}>Kelola produk</Link>
                </Button>
              ) : null
            }
          >
            <div className="space-y-3">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-md border border-border px-3 py-2">
                  <dt className="text-[11px] text-muted-foreground">Produk aktif</dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    {stats?.active_count ?? 0}
                  </dd>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <dt className="text-[11px] text-muted-foreground">Produk arsip</dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    {stats?.archived_count ?? 0}
                  </dd>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <dt className="text-[11px] text-muted-foreground">Varian</dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    {stats?.variant_count ?? 0}
                  </dd>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <dt className="text-[11px] text-muted-foreground">Sub model</dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    {stats?.designs?.length ?? 0}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                Kode model: {modelProduct?.product_model || "-"}. Wadah tanpa produk aktif tidak
                tampil di storefront.
              </p>
              {storefrontUrl ? (
                <a
                  href={storefrontUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Lihat di toko
                  <Icon name="arrow-up-right" className="size-3.5" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </SectionCard>
        ) : null}
      </form>
    </AdminLayout>
  )
}
