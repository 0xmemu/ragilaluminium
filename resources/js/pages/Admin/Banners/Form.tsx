import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { MediaPicker } from "@/components/admin/media-picker"
import { Button } from "@/components/admin/ui/button"
import { Field, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
import { HintTip } from "@/components/admin/ui/hint-tip"
import { Input } from "@/components/admin/ui/input"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { storeExampleUrl } from "@/lib/routes"

interface BannerFormData {
  id?: number
  title?: string | null
  image_url?: string | null
  link_url?: string | null
  published: boolean
  media_asset_id?: number | null
}

export default function BannerForm({
  banner,
  submitUrl,
  method,
  indexHref,
  backUrl,
}: {
  backUrl?: string | null
  banner: BannerFormData | null
  submitUrl: string
  method: "post" | "put"
  indexHref: string
}) {
  const isEdit = Boolean(banner?.id)
  // Status aktif tidak ditampilkan di form (sejajar dengan form Bar Promo):
  // dinyalakan/dimatikan lewat aksi Terbitkan/Sembunyikan di daftar. Nilainya
  // tetap ikut terkirim dari nilai awal supaya menyunting banner tidak pernah
  // mengubah status terbitnya tanpa disengaja.
  const form = useForm<{
    title: string
    link_url: string
    published: boolean
    media_asset_id: string
  }>({
    title: banner?.title ?? "",
    link_url: banner?.link_url ?? "",
    published: banner?.published ?? false,
    media_asset_id: banner?.media_asset_id ? String(banner.media_asset_id) : "",
  })
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [pickedPreview, setPickedPreview] = React.useState<string | null>(null)
  const previewUrl = pickedPreview ?? banner?.image_url ?? null

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (method === "put") {
      form.transform((data) => ({ ...data, _method: "put" }))
      form.post(submitUrl, {
        preserveScroll: true,
        onFinish: () => form.transform((data) => data),
      })
      return
    }
    form.post(submitUrl, { preserveScroll: true })
  }

  // Kontrak owner 2026-10-12: tombol simpan hanya hidup saat memang ada yang
  // bisa dikirim. Di form tambah syaratnya gambar sudah dipilih; di form edit
  // syaratnya sudah ada perubahan. Gambar tidak wajib saat menyunting banner
  // lama, jadi yang dihitung ada atau tidaknya gambar, bukan id asetnya.
  const gambarKosong = !previewUrl
  const belumBerubah = isEdit && !form.isDirty
  const terkunci = gambarKosong || belumBerubah
  const alasanTerkunci = gambarKosong
    ? "Pilih gambar banner dulu sebelum disimpan."
    : "Belum ada perubahan yang perlu disimpan."
  const tombolSimpan = (
    <Button type="submit" form="banner-form" disabled={form.processing || terkunci}>
      {form.processing ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
    </Button>
  )

  return (
    <AdminLayout
      backUrl={backUrl}
      title={isEdit ? "Edit Banner Promo" : "Tambah Banner Promo"}
      description="Slide banner di beranda, tampil setelah slide pembuka."
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={indexHref}>Batal</Link>
          </Button>
          {terkunci && !form.processing ? (
            <HintTip
              label={tombolSimpan}
              hint={alasanTerkunci}
              side="bottom"
              align="right"
              className="no-underline"
            />
          ) : (
            tombolSimpan
          )}
        </div>
      }
    >
      <Head title={`${isEdit ? "Edit" : "Tambah"} Banner Promo | Admin`} />

      <form id="banner-form" onSubmit={onSubmit} className="w-full space-y-6">
        <FormErrorSummary errors={form.errors} />

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Baris media ikut grid field (ADR-022), bukan stripe ber-padding
              sendiri, supaya tepi kiri/kanan lurus dengan field lain. */}
          <FieldGrid className="p-5 sm:p-6">
            <Field
              id="image"
              label="Gambar banner"
              error={form.errors.media_asset_id}
              required
              hint="Rasio 2,4:1 (rekomendasi 1600 × 664 px), dipilih dari Media Library."
              className="sm:col-span-2"
            >
              {/* Pratinjau lalu tombol, bertumpuk satu kolom: tombol selalu
                  lurus dengan tepi kiri pratinjau tanpa perlu trik penyelarasan
                  (ADR-022). */}
              <div className="space-y-3">
                <div className="aspect-[1024/426] w-full max-w-[260px] overflow-hidden rounded-md border border-border bg-muted">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Pratinjau banner" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center px-2 text-center text-[11px] leading-tight text-muted-foreground">
                      Tanpa gambar
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex w-fit items-center gap-1.5"
                >
                  <Icon name="image" className="size-3.5" aria-hidden="true" />
                  <span>{form.data.media_asset_id ? "Ganti gambar" : "Pilih gambar"}</span>
                </Button>
              </div>
            </Field>

            <Field
              id="title"
              label="Nama banner"
              error={form.errors.title}
              hint="Untuk daftar admin dan keterangan gambar di pembaca layar; tidak dicetak di atas gambar."
            >
              <Input
                value={form.data.title}
                onChange={(event) => form.setData("title", event.target.value)}
                placeholder="Mis. Diskon sampai 30%"
                maxLength={64}
              />
            </Field>
            <Field
              id="link"
              label="Link tujuan"
              error={form.errors.link_url}
              hint="Boleh alamat lengkap atau cukup bagian setelah nama domain."
            >
              <Input
                value={form.data.link_url}
                onChange={(event) => form.setData("link_url", event.target.value)}
                placeholder={storeExampleUrl("/product/RAF3QHJA5FHY")}
              />
            </Field>
          </FieldGrid>
        </section>
      </form>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        multiple={false}
        kind="image"
        title="Pilih Gambar Banner Promo"
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
