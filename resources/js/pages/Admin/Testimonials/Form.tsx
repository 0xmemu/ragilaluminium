import * as React from "react"
import { Head, Link, router, useForm } from "@inertiajs/react"

import { Button } from "@/components/admin/ui/button"
import { CheckboxField, Field, FieldAction, FormErrorSummary } from "@/components/admin/ui/field"
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"

interface TestimonialRecord {
  id: number
  customer_name: string
  message?: string | null
  rating?: number | null
  source: string
  location?: string | null
  product_id?: number | null
  image_url?: string | null
  image_urls?: string[] | null
  /** Semua foto ulasan berurutan, foto pertama = gambar utama (dari imagesPayload()). */
  photos?: string[] | null
  sort_order: number
  published: boolean
  author_type?: string
  moderation_status?: string
}

/**
 * Satu foto pada daftar foto ulasan.
 *
 * `kind: "library"` berarti foto dipilih dari Media Library dan dikirim sebagai
 * id aset (server yang menyelesaikan URL-nya, jadi URL basi tidak tersimpan).
 * `kind: "url"` berarti URL tempelan admin atau foto lama yang belum punya
 * aset, dikirim apa adanya.
 */
type PhotoRow = {
  key: string
  kind: "library" | "url"
  url: string
  assetId?: string
  label?: string
}

const DEFAULT_SOURCE_LABELS: Record<string, string> = {
  shopee: "Shopee",
  whatsapp: "WhatsApp",
  website: "Website",
  other: "Lainnya",
}

export default function TestimonialForm({
  testimonial,
  products,
  sources,
  sourceLabels,
  intent = "website",
  maxPhotos = 10,
  submitUrl,
  indexUrl,
  backUrl,
  moderateUrl = null,
}: {
  testimonial: TestimonialRecord | null
  products: Array<{ id: number; label: string }>
  sources: string[]
  sourceLabels?: Record<string, string>
  intent?: "marketplace" | "website"
  /** Batas jumlah foto ulasan; server memakai batas yang sama. */
  maxPhotos?: number
  submitUrl: string
  indexUrl: string
  backUrl?: string | null
  moderateUrl?: string | null
}) {
  const editing = Boolean(testimonial)
  const labels = sourceLabels ?? DEFAULT_SOURCE_LABELS
  const isMarketplaceIntent = intent === "marketplace"
  const form = useForm<{
    customer_name: string
    message: string
    rating: string
    source: string
    location: string
    product_id: string
    sort_order: number
    published: boolean
    moderation_status: string
  }>({
    customer_name: testimonial?.customer_name ?? "",
    message: testimonial?.message ?? "",
    rating: testimonial?.rating?.toString() ?? "",
    // Mode ulasan website WAJIB mulai dari "website". Sebelumnya nilai awal
    // diambil dari pilihan pertama daftar sumber (urutan model: Shopee lebih
    // dulu), sehingga form "Tambah ulasan" terbuka dalam wujud screenshot
    // marketplace: gambar jadi wajib dan hasilnya masuk tab Apa Kata Pelanggan.
    source: testimonial?.source ?? (isMarketplaceIntent ? sources[0] ?? "shopee" : "website"),
    location: testimonial?.location ?? "",
    product_id: testimonial?.product_id?.toString() ?? "",
    sort_order: testimonial?.sort_order ?? 0,
    published: testimonial?.published ?? isMarketplaceIntent,
    moderation_status: testimonial?.moderation_status ?? "approved",
  })

  const isMarketplace = ["shopee", "whatsapp"].includes(form.data.source) || isMarketplaceIntent

  // Daftar foto ulasan (permintaan owner 2026-09-29: satu ulasan boleh punya
  // banyak foto dari Media Library, bukan hanya satu). Urutan daftar = urutan
  // tampil; foto pertama adalah gambar utama yang dipakai kartu ringkas.
  const nomorFoto = React.useRef(0)
  const [photos, setPhotos] = React.useState<PhotoRow[]>(() =>
    (testimonial?.photos ?? [])
      .filter((url): url is string => Boolean(url))
      .map((url) => ({ key: `awal-${url}`, kind: "url" as const, url })),
  )
  const [urlBaru, setUrlBaru] = React.useState("")
  const [pickerOpen, setPickerOpen] = React.useState(false)

  const photosPenuh = photos.length >= maxPhotos
  // Galat foto datang dengan kunci yang dikirim server (photos/image_url/image),
  // sedangkan `photos` dirakit saat submit sehingga bukan kunci data form.
  const galatForm = form.errors as Record<string, string | undefined>
  const galatFoto = galatForm.photos ?? galatForm.image_url ?? galatForm.image

  function tambahDariLibrary(media: PickedMedia[]) {
    if (media.length === 0) return
    setPhotos((current) => {
      const adaId = new Set(current.map((row) => row.assetId).filter(Boolean))
      const baru = media
        .filter((asset) => !adaId.has(String(asset.assetId)))
        .map((asset) => {
          nomorFoto.current += 1
          return {
            key: `lib-${asset.assetId}-${nomorFoto.current}`,
            kind: "library" as const,
            url: asset.thumbUrl,
            assetId: String(asset.assetId),
            label: asset.label,
          }
        })
      return [...current, ...baru].slice(0, maxPhotos)
    })
  }

  function tambahUrl() {
    const url = urlBaru.trim()
    if (url === "" || photosPenuh) return
    nomorFoto.current += 1
    setPhotos((current) => [...current, { key: `url-${nomorFoto.current}`, kind: "url", url }])
    setUrlBaru("")
  }

  function hapusFoto(key: string) {
    setPhotos((current) => current.filter((row) => row.key !== key))
  }

  /** Jadikan foto ini gambar utama (dipindah ke urutan pertama). */
  function jadikanUtama(key: string) {
    setPhotos((current) => {
      const dipilih = current.find((row) => row.key === key)
      if (!dipilih) return current
      return [dipilih, ...current.filter((row) => row.key !== key)]
    })
  }

  return (
    <AdminLayout
      backUrl={backUrl}
      title={
        editing
          ? isMarketplaceIntent
            ? "Edit screenshot"
            : "Edit ulasan"
          : isMarketplaceIntent
            ? "Tambah screenshot"
            : "Tambah ulasan"
      }
      description={
        isMarketplaceIntent
          ? "Screenshot percakapan Shopee atau WhatsApp di luar transaksi website. Gambar wajib."
          : "Ulasan pembeli website: teks dan/atau gambar (boleh SS WA bila pelanggan tidak menulis ulasan)."
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="submit" form="testimonial-form" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : isMarketplaceIntent ? "Simpan screenshot" : "Simpan ulasan"}
          </Button>
          <Button asChild variant="secondary">
            <Link href={indexUrl}>Batal</Link>
          </Button>
        </div>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} ${isMarketplaceIntent ? "Screenshot" : "Ulasan"} | Admin`} />
      <form
        id="testimonial-form"
        onSubmit={(event) => {
          event.preventDefault()
          form.transform((data) => ({
            ...data,
            // Foto dikirim berurutan; server menyelesaikan URL aset library
            // sendiri lalu menetapkan foto pertama sebagai gambar utama.
            photos: photos.map((row) =>
              row.kind === "library" && row.assetId
                ? { kind: "library", asset_id: Number(row.assetId) }
                : { kind: "url", url: row.url },
            ),
            ...(editing ? { _method: "put" } : {}),
          }))
          form.post(submitUrl, { forceFormData: true })
        }}
        className="w-full space-y-5"
        encType="multipart/form-data"
      >
        <FormErrorSummary errors={form.errors} />
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <Field
              id="testimonial-image-library"
              label="Foto ulasan"
              error={galatFoto}
              hint={
                (isMarketplace
                  ? "Wajib. Screenshot Shopee/WhatsApp dari Media Library."
                  : "Opsional. Pilih dari Media Library atau tempel URL.")
                + ` Boleh lebih dari satu foto (maksimal ${maxPhotos}); foto pertama jadi gambar utama, dan di storefront semua foto bisa digeser saat diperbesar.`
              }
              required={isMarketplace}
              className="sm:col-span-2"
            >
              <div className="space-y-3">
                {photos.length ? (
                  <ul className="flex flex-wrap gap-3" aria-label="Daftar foto ulasan">
                    {photos.map((row, index) => (
                      <li
                        key={row.key}
                        className="w-28 space-y-1.5 rounded-md border border-border bg-card p-1.5"
                      >
                        <div className="relative size-24 overflow-hidden rounded-md border border-border bg-muted">
                          <img src={row.url} alt={row.label ?? "Pratinjau foto ulasan"} className="size-full object-cover" />
                          {index === 0 ? (
                            <span className="absolute left-1 top-1 rounded bg-foreground/85 px-1.5 py-0.5 text-[10px] font-semibold text-background">
                              Utama
                            </span>
                          ) : null}
                        </div>
                        {row.label ? (
                          <p className="truncate text-[10px] text-muted-foreground" title={row.label}>
                            {row.label}
                          </p>
                        ) : null}
                        <div className="flex items-center justify-between gap-1">
                          {index > 0 ? (
                            <button
                              type="button"
                              onClick={() => jadikanUtama(row.key)}
                              className="text-[11px] text-muted-foreground transition hover:text-foreground"
                            >
                              Jadikan utama
                            </button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Gambar utama</span>
                          )}
                          <button
                            type="button"
                            onClick={() => hapusFoto(row.key)}
                            className="text-[11px] text-destructive transition hover:underline"
                          >
                            Hapus
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Belum ada foto.</p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setPickerOpen(true)}
                    disabled={photosPenuh}
                    title={photosPenuh ? `Maksimal ${maxPhotos} foto. Hapus satu foto dulu untuk menambah.` : undefined}
                  >
                    Tambah dari Media Library
                  </Button>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <Input
                      value={urlBaru}
                      onChange={(event) => setUrlBaru(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          tambahUrl()
                        }
                      }}
                      placeholder="Tempel URL gambar lalu tekan Tambah"
                      disabled={photosPenuh}
                      aria-label="URL gambar ulasan"
                      className="min-w-[16rem] flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={tambahUrl}
                      disabled={photosPenuh || urlBaru.trim() === ""}
                    >
                      Tambah URL
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {photos.length} dari {maxPhotos} foto dipakai.
                  {photos.length > 1 ? " Urutan tampil mengikuti urutan daftar ini." : ""}
                </p>
              </div>
            </Field>
            <Field
              id="testimonial-customer"
              label="Nama pelanggan"
              required={!isMarketplaceIntent}
              error={form.errors.customer_name}
              hint={isMarketplaceIntent ? "Opsional. Kosongkan untuk tampil sebagai “Pelanggan”." : undefined}
            >
              <Input value={form.data.customer_name} onChange={(event) => form.setData("customer_name", event.target.value)} />
            </Field>
            <Field id="testimonial-location" label="Lokasi" error={form.errors.location}>
              <Input value={form.data.location} onChange={(event) => form.setData("location", event.target.value)} />
            </Field>
            {editing && moderateUrl ? (
              <div className="sm:col-span-2 rounded-lg border border-border bg-muted/20 p-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <Field id="testimonial-moderation" label="Status moderasi" error={form.errors.moderation_status} hint="Teks pelanggan tetap immutable; rejected otomatis disembunyikan.">
                    <Select value={form.data.moderation_status} onChange={(event) => form.setData("moderation_status", event.target.value)}>
                      <option value="pending">Menunggu moderasi</option><option value="approved">Disetujui</option><option value="rejected">Ditolak</option>
                    </Select>
                  </Field>
                  <FieldAction>
                    <Button type="button" variant="secondary" disabled={form.processing} onClick={() => router.post(moderateUrl, { moderation_status: form.data.moderation_status }, { preserveScroll: true })}>Simpan moderasi</Button>
                  </FieldAction>
                </div>
              </div>
            ) : null}
            {!isMarketplaceIntent ? (
              <Field
                id="testimonial-message"
                label="Isi ulasan"
                error={form.errors.message}
                className="sm:col-span-2"
                hint="Opsional jika ada gambar. Wajib salah satu: teks atau gambar."
              >
                <Textarea rows={7} value={form.data.message} onChange={(event) => form.setData("message", event.target.value)} />
              </Field>
            ) : (
              <Field
                id="testimonial-message"
                label="Deskripsi (opsional)"
                error={form.errors.message}
                className="sm:col-span-2"
                hint="Tidak wajib. Storefront menampilkan screenshot, bukan teks panjang."
              >
                <Textarea rows={3} value={form.data.message} onChange={(event) => form.setData("message", event.target.value)} />
              </Field>
            )}

            {!isMarketplaceIntent ? (
              <Field id="testimonial-rating" label="Rating" error={form.errors.rating}>
                <Select value={form.data.rating} onChange={(event) => form.setData("rating", event.target.value)}>
                  <option value="">Tanpa rating</option>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <option key={rating} value={rating}>{rating} bintang</option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field
              id="testimonial-source"
              label="Sumber"
              required
              error={form.errors.source}
              hint={
                isMarketplace
                  ? "Tampil di section Apa kata pelanggan kami (screenshot)."
                  : "Tampil di section Ulasan pelanggan di website."
              }
            >
              <Select value={form.data.source} onChange={(event) => form.setData("source", event.target.value)}>
                {sources.map((source) => (
                  <option key={source} value={source}>{labels[source] ?? source}</option>
                ))}
              </Select>
            </Field>

            {!isMarketplaceIntent ? (
              <Field id="testimonial-product" label="Produk terkait" error={form.errors.product_id} className="sm:col-span-2">
                <Select value={form.data.product_id} onChange={(event) => form.setData("product_id", event.target.value)}>
                  <option value="">Ulasan umum (/reviews saja)</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.label}</option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {!isMarketplaceIntent ? (
              <Field id="testimonial-sort" label="Urutan" error={form.errors.sort_order}>
                <Input
                  type="number"
                  min="0"
                  value={form.data.sort_order}
                  onChange={(event) => form.setData("sort_order", Number(event.target.value))}
                />
              </Field>
            ) : (
              <p className="sm:col-span-2 text-sm text-muted-foreground">
                Urutan tampilan diubah di daftar Apa Kata Pelanggan lewat tombol <strong>Urutkan</strong>.
              </p>
            )}
            {!isMarketplaceIntent ? (
              <CheckboxField
                id="testimonial-published"
                checked={form.data.published}
                onChange={(checked) => form.setData("published", checked)}
                label="Tampilkan di storefront"
              />
            ) : null}
          </div>
        </section>
      </form>
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={tambahDariLibrary}
        multiple
        title="Pilih foto ulasan dari Media Library"
      />
    </AdminLayout>
  )
}
