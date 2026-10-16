import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { MediaGallerySection, type MediaGalleryItem } from "@/components/admin/media-gallery-section"
import type { PickedMedia } from "@/components/admin/media-picker"
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
    product_model: modelProduct?.product_model ?? "",
    product_category: modelProduct?.product_category ?? "",
    image_url: modelProduct?.image_url ?? "",
    media_asset_id: media?.assetId ?? null,
    gallery_asset_ids: (gallery ?? []).map((item) => item.assetId),
    media_show_product_photos: modelProduct?.media_show_product_photos ?? true,
    description: modelProduct?.description ?? "",
    keywords: modelProduct?.keywords ?? [],
    status: modelProduct?.status ?? "draft",
  })

  // Satu daftar berurutan (pola seksi Foto Produk): pilihan pertama jadi
  // gambar utama, pilihan berikutnya mengisi galeri. Server menyimpan urutan
  // galeri, jadi urutan di sini = urutan hero storefront.
  const [pickedMedia, setPickedMedia] = React.useState<MediaGalleryItem[]>(() => [
    ...(media
      ? [{ key: `lib-${media.assetId}`, assetId: media.assetId, url: media.thumbUrl, label: media.label }]
      : []),
    ...(gallery ?? []).map((item) => ({
      key: `lib-${item.assetId}`,
      assetId: item.assetId,
      url: item.thumbUrl,
      label: item.label,
    })),
  ])
  const maxMedia = maxGallery + 1

  // Sinkron dari snapshot server HANYA saat isinya benar-benar berubah:
  // Inertia mengirim array baru pada setiap re-render (termasuk setelah
  // validasi gagal), jadi perbandingan identitas akan menghapus pilihan
  // yang baru saja dibuat admin.
  const daftarSignature = [media?.assetId ?? "", ...(gallery ?? []).map((item) => item.assetId)].join(",")
  const appliedSignature = React.useRef(daftarSignature)

  React.useEffect(() => {
    if (appliedSignature.current === daftarSignature) return
    appliedSignature.current = daftarSignature
    const awal: MediaGalleryItem[] = [
      ...(media
        ? [{ key: `lib-${media.assetId}`, assetId: media.assetId, url: media.thumbUrl, label: media.label }]
        : []),
      ...(gallery ?? []).map((item) => ({
        key: `lib-${item.assetId}`,
        assetId: item.assetId,
        url: item.thumbUrl,
        label: item.label,
      })),
    ]
    setPickedMedia(awal)
    form.setData("media_asset_id", awal[0]?.assetId ?? null)
    form.setData("gallery_asset_ids", awal.slice(1).flatMap((item) => (item.assetId ? [item.assetId] : [])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daftarSignature])

  function terapkanMedia(next: MediaGalleryItem[]) {
    setPickedMedia(next)
    form.setData("media_asset_id", next[0]?.assetId ?? null)
    form.setData("gallery_asset_ids", next.slice(1).flatMap((item) => (item.assetId ? [item.assetId] : [])))
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
                  Kode Model Produk
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    value={form.data.product_model ?? ""}
                    onChange={(event) => form.setData("product_model", event.target.value.toUpperCase().replace(/[-\s]+/g, "_"))}
                    placeholder="Otomatis dibuat dari nama jika kosong (misal: PINTU_LIPAT)"
                    className="h-8 w-80 font-mono text-xs"
                    disabled={editing}
                  />
                  {form.errors.product_model ? <p className="mt-1 text-xs text-destructive">{form.errors.product_model}</p> : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {editing
                      ? "Kode model terkunci setelah dibuat agar tidak memutus tautan produk katalog."
                      : "Gunakan huruf besar dan garis bawah (contoh: PINTU_LIPAT, CASEMENT). Kosongkan untuk otomatis."}
                  </p>
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

        <MediaGallerySection
          title="Media model"
          items={pickedMedia}
          onChange={terapkanMedia}
          max={maxMedia}
          legacy={
            form.data.image_url
              ? { url: form.data.image_url, onClear: () => form.setData("image_url", "") }
              : null
          }
          errors={[form.errors.media_asset_id, form.errors.image_url, form.errors.gallery_asset_ids]}
        />

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
