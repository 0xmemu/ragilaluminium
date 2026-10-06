import * as React from "react"
import { Head, Link, router, useForm } from "@inertiajs/react"

import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { SectionCard } from "@/components/admin/section-card"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Field, FieldAction, FormErrorSummary } from "@/components/admin/ui/field"
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker"
import { ProductPicker, type PickerProduct } from "@/components/admin/ui/ProductPicker"
import { Sheet, SheetContent } from "@/components/admin/ui/sheet"
import { Icon } from "@/components/shared/icon"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { formatDate } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"

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

  // Kontrak ADR-023: halaman yang membuka data yang SUDAH ada dimulai dari
  // RINGKASAN (baca saja), bukan form langsung aktif. Inilah yang membuat klik
  // nama pelanggan di daftar tidak lagi mendarat langsung di form edit.
  // Alur tambah data baru tetap form langsung (pengecualian ADR-023).
  const [mode, setMode] = React.useState<"view" | "edit">(editing ? "view" : "edit")
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
  const isPublished = Boolean(testimonial?.published ?? true)

  // Foto ulasan (permintaan owner 2026-09-29). Skemanya SAMA dengan form admin
  // lain (ProductForm, ModelProducts, MasalahSolusi): daftar `media_asset_ids`
  // berurutan, foto pertama = gambar utama. URL tempelan tetap memakai skema
  // lama `image_urls` supaya tautan luar dan foto warisan tidak hilang.
  const nomorFoto = React.useRef(0)
  const [photos, setPhotos] = React.useState<PhotoRow[]>(() =>
    (testimonial?.photos ?? [])
      .filter((url): url is string => Boolean(url))
      // Penghitung lokal, bukan ref: mengubah ref saat render dilarang React.
      .map((url, index) => ({ key: `awal-${index + 1}`, url })),
  )
  const [pickerOpen, setPickerOpen] = React.useState(false)

  // Produk terkait (permintaan owner 2026-09-29: pakai produk picker reusable).
  // Satu ulasan menautkan satu produk; pilihannya live lewat onSelect.
  const [produkPicked, setProdukPicked] = React.useState<PickerProduct | null>(initialProduct)
  const [produkPickerTerbuka, setProdukPickerTerbuka] = React.useState(false)

  const photosPenuh = photos.length >= maxPhotos
  // Galat foto datang dengan kunci yang dikirim server; `photos` dirakit saat
  // submit sehingga bukan kunci data form.
  const galatForm = form.errors as Record<string, string | undefined>
  const galatFoto = galatForm.media_asset_ids ?? galatForm.image_urls ?? galatForm.image_url ?? galatForm.image

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
            url: asset.thumbUrl,
            assetId: String(asset.assetId),
            label: asset.label,
          }
        })
      return [...current, ...baru].slice(0, maxPhotos)
    })
  }

  function hapusFoto(key: string) {
    setPhotos((current) => current.filter((row) => row.key !== key))
  }

  /** Geser foto satu posisi ke kiri/kanan; urutan daftar = urutan tampil. */
  function geserFoto(key: string, arah: -1 | 1) {
    setPhotos((current) => {
      const dari = current.findIndex((row) => row.key === key)
      if (dari < 0) return current
      // Geser hanya di dalam kelompoknya (Library atau URL). Skema simpan
      // menaruh foto Library lebih dulu, jadi mengizinkan URL naik melewati
      // foto Library akan membuat urutan di layar berbeda dari hasil simpan.
      const row = current[dari]
      let ke = dari + arah
      while (ke >= 0 && ke < current.length && Boolean(current[ke].assetId) !== Boolean(row.assetId)) {
        ke += arah
      }
      if (ke < 0 || ke >= current.length) return current
      const next = [...current]
      const [dipindah] = next.splice(dari, 1)
      next.splice(ke, 0, dipindah)
      return next
    })
  }

  // Judul menyesuaikan mode: halaman ini punya tiga keadaan (tambah, baca,
  // ubah), supaya tidak lagi berbunyi "Edit" saat sedang dibaca.
  const judulHalaman = !editing
    ? `Tambah ${isMarketplaceIntent ? "Screenshot" : "Ulasan"}`
    : mode === "view"
      ? `Detail ${isMarketplaceIntent ? "Screenshot" : "Ulasan"}`
      : `Edit ${isMarketplaceIntent ? "Screenshot" : "Ulasan"}`

  const labelSumber = labels[form.data.source] ?? form.data.source
  const labelModerasi =
    form.data.moderation_status === "pending"
      ? "Menunggu moderasi"
      : form.data.moderation_status === "rejected"
        ? "Ditolak"
        : "Disetujui"


  // Ringkasan (mode baca): SATU kartu ulasan utuh membentang penuh, lalu
  // baris produk slim di bawahnya. Baris kartu KPI dan pemecahan dua kolom
  // dihapus: datanya cuma satu ulasan, jadi empat kartu besar tampak kosong,
  // kolom kiri-kanan tak seimbang, dan foto kecil tenggelam di kartu luas.
  // Info KPI tetap lengkap: tanggal di header kartu, bintang di baris
  // pelanggan, status visibilitas + moderasi sebagai badge header.
  const ringkasan = (
    <div className="w-full space-y-6">
      <SectionCard
        title={isMarketplaceIntent ? "Screenshot Pelanggan" : "Ulasan Pembeli"}
        description={testimonial?.created_at ? `Dikirim ${formatDate(testimonial.created_at)}` : undefined}
        icon="chat"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={isPublished ? "active" : "inactive"}
              label={isPublished ? "Tampil di website" : "Tersembunyi"}
            />
            <StatusBadge
              status={
                form.data.moderation_status === "approved"
                  ? "active"
                  : form.data.moderation_status === "rejected"
                    ? "inactive"
                    : "pending"
              }
              label={labelModerasi}
            />
          </div>
        }
      >
        <div className="space-y-5">
          {/* Pelanggan di kiri, rating di kanan: satu baris, tanpa kartu terpisah */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
                {form.data.customer_name.trim() ? form.data.customer_name.trim()[0].toUpperCase() : "P"}
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-foreground">
                  {form.data.customer_name.trim() || "Pelanggan"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {[labelSumber, form.data.location].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            {form.data.rating ? (
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-0.5 text-warning"
                  aria-label={`${form.data.rating} dari 5 bintang`}
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <Icon
                      key={i}
                      name="star"
                      weight="fill"
                      className={cn("size-4", i < Number(form.data.rating) ? "text-warning" : "text-muted/30")}
                      aria-hidden="true"
                    />
                  ))}
                </span>
                <span className="font-mono text-sm font-bold text-foreground">{form.data.rating} / 5</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Tanpa rating</span>
            )}
          </div>

          {/* Isi ulasan: teks utama halaman, tanpa kotak ganda */}
          <p className="whitespace-pre-line text-base leading-relaxed text-foreground">
            {form.data.message.trim() || (
              <span className="italic text-muted-foreground">
                Tidak ada ulasan teks (hanya foto / screenshot).
              </span>
            )}
          </p>

          {/* Balasan toko (jika ada) */}
          {testimonial?.admin_reply ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Icon name="storefront" className="size-3.5" aria-hidden="true" />
                  <span>Balasan Ragil Aluminium</span>
                </p>
                {testimonial.admin_replied_at ? (
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(testimonial.admin_replied_at)}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                {testimonial.admin_reply}
              </p>
            </div>
          ) : null}

          {/* Foto menyatu dengan ulasannya, tile besar sesuai lebar kartu */}
          {photos.length > 0 ? (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground">
                {isMarketplaceIntent ? `Screenshot (${photos.length})` : `Foto (${photos.length})`}
              </p>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5" aria-label="Foto ulasan">
                {photos.map((row, index) => (
                  <li
                    key={row.key}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-muted"
                  >
                    <img
                      src={row.url}
                      alt={row.label ?? `Foto ${index + 1}`}
                      className="size-full object-cover transition duration-150 group-hover:scale-105"
                    />
                    {index === 0 ? (
                      <span className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-xs">
                        Foto Utama
                      </span>
                    ) : null}
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-semibold text-white opacity-0 transition-opacity hover:opacity-100"
                      title="Buka foto ukuran penuh"
                    >
                      Lihat foto
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {/* Produk terkait: satu baris slim, hanya bila ulasan benar-benar menautkan produk */}
      {!isMarketplaceIntent && produkPicked ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon name="package" className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{produkPicked.name}</p>
              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                {[
                  produkPicked.parent_sku ? `SKU ${produkPicked.parent_sku}` : null,
                  produkPicked.category,
                  produkPicked.model,
                  produkPicked.sub_model,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          {produkPicked.id ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={routeUrl("admin.products.show", { product: produkPicked.id })}>Buka produk</Link>
            </Button>
          ) : null}
        </Card>
      ) : null}
    </div>
  )
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
          {mode === "view" ? (
            <Button type="button" onClick={() => setMode("edit")} className="inline-flex items-center gap-1.5">
              <Icon name="pencil-simple" className="size-4" aria-hidden="true" />
              <span>{isMarketplaceIntent ? "Edit screenshot" : "Edit ulasan"}</span>
            </Button>
          ) : (
            <>
              <Button type="submit" form="testimonial-form" disabled={form.processing}>
                {form.processing ? "Menyimpan..." : isMarketplaceIntent ? "Simpan screenshot" : "Simpan ulasan"}
              </Button>
              {editing ? (
                // Batal mengembalikan ke ringkasan, bukan meninggalkan halaman.
                <Button type="button" variant="secondary" onClick={() => setMode("view")}>
                  Batal
                </Button>
              ) : (
                <Button asChild variant="secondary">
                  <Link href={indexUrl}>Batal</Link>
                </Button>
              )}
            </>
          )}
        </div>
      }
    >
      <Head title={`${judulHalaman} | Admin`} />
      {mode === "view" ? (
        ringkasan
      ) : (
      <form
        id="testimonial-form"
        onSubmit={(event) => {
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
          form.post(submitUrl, {
            forceFormData: true,
            // Simpan sukses kembali ke ringkasan (ADR-023).
            onSuccess: () => setMode("view"),
          })
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
                // Foto hanya dari Media Library (koreksi owner 2026-09-29:
                // "buang ini, media picker sudah cukup"). Isian URL tempelan
                // dihapus; foto lama yang tersimpan sebagai tautan tetap
                // tampil di grid ini dan bisa dihapus.
                (isMarketplace
                  ? "Wajib. Screenshot Shopee/WhatsApp dari Media Library."
                  : "Opsional. Pilih dari Media Library.")
                + ` Boleh lebih dari satu foto (maksimal ${maxPhotos}); foto pertama jadi gambar utama, dan di storefront semua foto bisa digeser saat diperbesar.`
              }
              required={isMarketplace}
              className="sm:col-span-2"
            >
              <div className="space-y-3">
                {photos.length ? (
                  // Grid, badge, geser, dan hapus mengikuti pola galeri Model
                  // Produk supaya cara kerjanya sama di seluruh panel admin.
                  <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5" aria-label="Daftar foto ulasan">
                    {photos.map((row, index) => (
                      <li key={row.key} className="group relative">
                        <div className="relative aspect-square w-full overflow-hidden rounded-md border border-border bg-surface-muted">
                          <img
                            src={row.url}
                            alt={row.label ?? `Foto ulasan ${index + 1}`}
                            className="size-full object-cover"
                          />
                          {index === 0 ? (
                            <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
                              Utama
                            </span>
                          ) : null}
                          {!row.assetId ? (
                            <span
                              className="absolute right-1 top-1 rounded bg-foreground/80 px-1.5 py-0.5 text-[9px] font-semibold text-background"
                              title="Foto lama dari tautan luar. Masih tampil di storefront; hapus lalu pilih ulang dari Media Library bila ingin menggantinya."
                            >
                              URL
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-1">
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => geserFoto(row.key, -1)}
                              disabled={index === 0}
                              className="rounded p-0.5 text-muted-foreground transition hover:text-foreground disabled:opacity-30"
                              aria-label={`Geser foto ${index + 1} ke kiri`}
                            >
                              <Icon name="caret-left" className="size-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => geserFoto(row.key, 1)}
                              disabled={index === photos.length - 1}
                              className="rounded p-0.5 text-muted-foreground transition hover:text-foreground disabled:opacity-30"
                              aria-label={`Geser foto ${index + 1} ke kanan`}
                            >
                              <Icon name="caret-right" className="size-3.5" aria-hidden="true" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => hapusFoto(row.key)}
                            className="rounded p-0.5 text-muted-foreground transition hover:text-destructive"
                            aria-label={`Hapus foto ${index + 1}`}
                          >
                            <Icon name="trash-2" className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                        {row.label ? (
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground" title={row.label}>
                            {row.label}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  // Kotak kosong BISA DIKLIK untuk membuka Media Library. Bukan
                  // zona drag&drop (catatan owner 2026-09-29: drag&drop harusnya
                  // bisa di klik).
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="w-full rounded-md border border-dashed border-border py-8 text-center transition hover:border-foreground/40 hover:bg-muted/30"
                  >
                    <Icon name="images" className="mx-auto size-6 text-muted-foreground/70" aria-hidden="true" />
                    <p className="mt-1.5 text-xs font-medium text-foreground">
                      Klik untuk pilih foto dari Media Library
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Boleh pilih lebih dari satu foto.
                    </p>
                  </button>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setPickerOpen(true)}
                    disabled={photosPenuh}
                    title={photosPenuh ? `Maksimal ${maxPhotos} foto. Hapus satu foto dulu untuk menambah.` : undefined}
                  >
                    <Icon name="images" className="size-4" aria-hidden="true" />
                    Tambah dari Media Library
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {photos.length} dari {maxPhotos} foto dipakai.
                  {photos.length > 1 ? " Urutan tampil mengikuti urutan grid ini." : ""}
                </p>
              </div>
            </Field>
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
                <Input value={form.data.customer_name} onChange={(event) => form.setData("customer_name", event.target.value)} />
              </Field>
              <Field id="testimonial-location" label="Lokasi" error={form.errors.location}>
                <Input value={form.data.location} onChange={(event) => form.setData("location", event.target.value)} />
              </Field>
              {!isMarketplaceIntent ? (
                <Field id="testimonial-rating" label="Rating" error={form.errors.rating}>
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
                </Field>
              ) : null}
              {!isMarketplaceIntent ? (
                <Field
                  id="testimonial-product"
                  label="Produk terkait"
                  error={form.errors.product_id}
                  hint="Opsional. Ulasan tanpa produk tetap tampil di /reviews saja."
                >
                  <Button
                    type="button"
                    variant={produkPicked ? "outline" : "secondary"}
                    onClick={() => setProdukPickerTerbuka(true)}
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
      )}
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={tambahDariLibrary}
        multiple
        title="Pilih foto ulasan dari Media Library"
      />
      <Sheet open={produkPickerTerbuka} onOpenChange={setProdukPickerTerbuka}>
        <SheetContent side="right" title="Pilih produk terkait" className="w-full overflow-y-auto sm:max-w-3xl">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Pilih produk terkait</h2>
            <p className="text-sm text-muted-foreground">
              Cari produk yang diulas. Satu ulasan hanya menautkan satu produk; kosongkan untuk ulasan umum.
            </p>
          </div>
          <div className="mt-4 space-y-4">
            <ProductPicker
              maxSelection={1}
              initialSelection={produkPicked ? [produkPicked] : []}
              onSelect={(products) => setProdukPicked(products[0] ?? null)}
            />
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="ghost" onClick={() => setProdukPickerTerbuka(false)}>
                Tutup
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  )
}
