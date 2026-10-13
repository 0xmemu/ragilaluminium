import * as React from "react"
import { Head, Link, router, useForm } from "@inertiajs/react"

import { Button } from "@/components/admin/ui/button"
import { Field, FieldAction, FormErrorSummary } from "@/components/admin/ui/field"
import { MediaGallerySection, type MediaGalleryItem } from "@/components/admin/media-gallery-section"
import type { PickerProduct } from "@/components/admin/ui/ProductPicker"
import { ProductPickerSheet } from "@/components/admin/product-picker-sheet"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { SubmitGateButton } from "@/components/admin/ui/submit-gate-button"
import { gerbangBolehLanjut } from "@/lib/submit-gate"

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
  created_at?: string | null
  admin_reply?: string | null
  admin_replied_at?: string | null
}

/**
 * Satu foto pada daftar foto ulasan.
 *
 * Dua sumber, dua kolom: foto dari Media Library dikirim sebagai id aset
 * (`media_asset_ids`, skema yang sama dengan form admin lain sehingga server
 * yang menyelesaikan URL-nya), sedangkan URL tempelan dan foto warisan dikirim
 * apa adanya lewat `image_urls` (skema lama, tetap dipakai supaya tautan luar
 * tidak hilang).
 */
type PhotoRow = {
  key: string
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
  initialProduct = null,
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
  /** Produk terkait yang sudah tersimpan, untuk pratinjau saat menyunting. */
  initialProduct?: PickerProduct | null
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

  // Halaman ini MURNI form (tambah dan ubah). Membaca ulasan pindah ke popup
  // detail di daftar (owner 2026-10-06: "hapus halaman detail ulasan, gantikan
  // dengan popup saja"), jadi mode ringkasan di sini dihapus.
  const form = useForm<{
    customer_name: string
    message: string
    rating: string
    source: string
    location: string
    product_id: string
    /** Foto dari Media Library, berurutan seperti skema form admin lain. */
    media_asset_ids: number[]
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
    media_asset_ids: [],
    moderation_status: testimonial?.moderation_status ?? "approved",
  })

  const isMarketplace = ["shopee", "whatsapp"].includes(form.data.source) || isMarketplaceIntent
  // Ulasan kiriman pelanggan dikunci server: nama, rating, dan teks
  // dikembalikan ke nilai asli saat menyimpan (kontrak "verified review").
  // Isian untuk kolom itu tidak boleh tampil bisa diketik, supaya admin
  // tidak mengetik perubahan yang dibuang diam-diam.
  const ulasanTerkunci = editing && (testimonial?.author_type ?? "customer") === "customer"

  // Foto ulasan: satu daftar berurutan, foto pertama = gambar utama. Skema
  // simpan tetap `media_asset_ids` (aset Media Library, terurut) + `image_urls`
  // (tautan luar/foto warisan) supaya tautan lama tidak hilang.
  const [photos, setPhotos] = React.useState<PhotoRow[]>(() =>
    (testimonial?.photos ?? [])
      .filter((url): url is string => Boolean(url))
      .map((url, index) => ({ key: `awal-${index + 1}`, url })),
  )

  // Produk terkait (permintaan owner 2026-09-29: pakai produk picker reusable).
  // Satu ulasan menautkan satu produk; pilihannya live lewat onSelect.
  const [produkPicked, setProdukPicked] = React.useState<PickerProduct | null>(initialProduct)

  // Galat foto datang dengan kunci yang dikirim server; `photos` dirakit saat
  // submit sehingga bukan kunci data form.
  const galatForm = form.errors as Record<string, string | undefined>
  const galatFoto = galatForm.media_asset_ids ?? galatForm.image_urls ?? galatForm.image_url ?? galatForm.image

  // Pemetaan dua arah antara baris foto halaman ini dan item MediaGallerySection.
  const itemFoto: MediaGalleryItem[] = photos.map((row) => ({
    key: row.key,
    assetId: row.assetId ? Number(row.assetId) : undefined,
    url: row.url,
    label: row.label,
  }))

  function gantiFoto(next: MediaGalleryItem[]) {
    setPhotos(
      next.map((item) => ({
        key: item.key,
        url: item.url,
        assetId: item.assetId ? String(item.assetId) : undefined,
        label: item.label,
      })),
    )
  }

  // Dua keadaan saja: tambah dan ubah. Keadaan baca pindah ke popup detail.
  const judulHalaman = !editing
    ? `Tambah ${isMarketplaceIntent ? "Screenshot" : "Ulasan"}`
    : `Edit ${isMarketplaceIntent ? "Screenshot" : "Ulasan"}`



  // Gerbang isi tombol simpan: kolom wajibnya mengikuti aturan `required`
  // controller, jadi frontend tidak menciptakan aturan baru.
  const gerbang = {
    fields: {"source": "Sumber"},
    requireChange: editing,
  }

  return (
    <AdminLayout
      backUrl={backUrl}
      title={judulHalaman}
      description={
        isMarketplaceIntent
          ? "Screenshot percakapan Shopee atau WhatsApp di luar transaksi website. Gambar wajib."
          : "Ulasan pembeli website: teks dan/atau gambar (boleh SS WA bila pelanggan tidak menulis ulasan)."
      }
      actions={
        <div className="flex flex-wrap gap-2">
                    <SubmitGateButton
            form={form}
            {...gerbang}
            formId="testimonial-form"
          >
            {isMarketplaceIntent ? "Simpan screenshot" : "Simpan ulasan"}
          </SubmitGateButton>
          <Button asChild variant="secondary">
            <Link href={indexUrl}>Batal</Link>
          </Button>
        </div>
      }
    >
      <Head title={`${judulHalaman} | Admin`} />
      <form
        id="testimonial-form"
        onSubmit={(event) => {
          if (!gerbangBolehLanjut(event, form, gerbang)) return
          event.preventDefault()
          form.transform((data) => ({
            ...data,
            // Skema sama dengan form admin lain: `media_asset_ids` berurutan
            // (foto pertama = gambar utama) untuk aset Media Library, dan
            // `image_urls` untuk URL tempelan/foto warisan.
            media_asset_ids: photos
              .filter((row) => row.assetId)
              .map((row) => Number(row.assetId)),
            image_urls: photos.filter((row) => !row.assetId).map((row) => row.url),
            product_id: produkPicked ? String(produkPicked.id) : "",
            ...(editing ? { _method: "put" } : {}),
          }))
          // Arah setelah simpan ditentukan server (kembali ke daftar ulasan).
          form.post(submitUrl, { forceFormData: true })
        }}
        className="w-full space-y-5"
        encType="multipart/form-data"
      >
        <FormErrorSummary errors={form.errors} />
        {ulasanTerkunci ? (
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            Ulasan kiriman pelanggan: nama, rating, dan isi ulasan terkunci karena itu yang dikirim
            pelanggan. Yang bisa diubah admin: lokasi, produk terkait, foto, dan status moderasi.
          </div>
        ) : null}
        <MediaGallerySection
          title="Foto ulasan"
          items={itemFoto}
          onChange={gantiFoto}
          max={maxPhotos}
          errors={[galatFoto]}
        />

        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            {/* Form isian setelah foto: DUA baris, dua kolom (revisi owner
                2026-09-29 dari satu baris empat kolom). Intent marketplace
                hanya punya dua isian, jadi cukup satu baris. */}
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
              <Field
                id="testimonial-customer"
                label="Nama pelanggan"
                required={!isMarketplaceIntent}
                error={form.errors.customer_name}
                hint={isMarketplaceIntent ? "Opsional. Kosongkan untuk tampil sebagai “Pelanggan”." : undefined}
              >
                {ulasanTerkunci ? (
                  <p className="text-sm text-foreground">{form.data.customer_name.trim() || "Pelanggan"}</p>
                ) : (
                  <Input value={form.data.customer_name} onChange={(event) => form.setData("customer_name", event.target.value)} />
                )}
              </Field>
              <Field id="testimonial-location" label="Lokasi" error={form.errors.location}>
                <Input value={form.data.location} onChange={(event) => form.setData("location", event.target.value)} />
              </Field>
              {!isMarketplaceIntent ? (
                <Field id="testimonial-rating" label="Rating" error={form.errors.rating}>
                  {ulasanTerkunci ? (
                    <p className="text-sm text-foreground">
                      {form.data.rating ? "★".repeat(Number(form.data.rating)) + " " + form.data.rating + " bintang" : "Tanpa rating"}
                    </p>
                  ) : (
                    <Select value={form.data.rating} onChange={(event) => form.setData("rating", event.target.value)}>
                      <option value="">Tanpa rating</option>
                      {[1, 2, 3, 4, 5].map((rating) => (
                        // Bintang supaya pilihan terlihat seperti rating sungguhan,
                        // bukan angka polos (catatan owner 2026-09-29). Label wajib
                        // SATU string: komponen Select memakai children apa adanya,
                        // children berupa array jatuh ke nilai angka.
                        <option key={rating} value={rating}>{'★'.repeat(rating) + ' ' + rating + ' bintang'}</option>
                      ))}
                    </Select>
                  )}
                </Field>
              ) : null}
              {!isMarketplaceIntent ? (
                <Field
                  id="testimonial-product"
                  label="Produk terkait"
                  error={form.errors.product_id}
                  hint="Opsional. Ulasan tanpa produk tetap tampil di /reviews saja."
                >
                  <ProductPickerSheet
                    title="Pilih produk terkait"
                    description="Cari produk yang diulas. Satu ulasan hanya menautkan satu produk; kosongkan untuk ulasan umum."
                    maxSelection={1}
                    initialSelection={produkPicked ? [produkPicked] : []}
                    onSelect={(products) => setProdukPicked(products[0] ?? null)}
                    trigger={(open) => (
                      <Button
                        type="button"
                        variant={produkPicked ? "outline" : "secondary"}
                        onClick={open}
                        className="max-w-full"
                      >
                        {produkPicked ? (
                          <>
                            <span className="min-w-0 truncate">{produkPicked.name}</span>
                            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{produkPicked.parent_sku}</span>
                          </>
                        ) : (
                          "Pilih produk"
                        )}
                      </Button>
                    )}
                  />
                  {produkPicked ? (
                    <button
                      type="button"
                      onClick={() => setProdukPicked(null)}
                      className="text-xs text-muted-foreground transition hover:text-foreground"
                    >
                      Kosongkan (jadi ulasan umum)
                    </button>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Tanpa produk = ulasan umum.</p>
                  )}
                </Field>
              ) : null}
            </div>
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
                {ulasanTerkunci ? (
                  <p className="whitespace-pre-line text-sm text-foreground">{form.data.message.trim() || "-"}</p>
                ) : (
                  <Textarea rows={7} value={form.data.message} onChange={(event) => form.setData("message", event.target.value)} />
                )}
              </Field>
            ) : (
              <Field
                id="testimonial-message"
                label="Deskripsi (opsional)"
                error={form.errors.message}
                className="sm:col-span-2"
                hint="Tidak wajib. Storefront menampilkan screenshot, bukan teks panjang."
              >
                {ulasanTerkunci ? (
                  <p className="whitespace-pre-line text-sm text-foreground">{form.data.message.trim() || "-"}</p>
                ) : (
                  <Textarea rows={3} value={form.data.message} onChange={(event) => form.setData("message", event.target.value)} />
                )}
              </Field>
            )}
            {isMarketplace ? (
              // Pilihan sumber hanya untuk screenshot marketplace (Shopee atau
              // WhatsApp). Ulasan yang dibuat dari form website definisinya
              // sumber "website", jadi dropdownnya tidak ditampilkan
              // (catatan owner 2026-09-29: "kenapa ada sumber juga di ulasan/web").
              <Field
                id="testimonial-source"
                label="Sumber"
                required
                error={form.errors.source}
                hint="Tampil di section Apa kata pelanggan kami (screenshot)."
              >
                <Select value={form.data.source} onChange={(event) => form.setData("source", event.target.value)}>
                  {sources.map((source) => (
                    <option key={source} value={source}>{labels[source] ?? source}</option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
        </section>
      </form>
</AdminLayout>
  )
}
