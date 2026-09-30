import { Head, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { MediaPicker } from "@/components/admin/media-picker"
import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"

type PlatformRow = {
  key: string
  label: string
  channel: "marketplace" | "social"
  icon: string | null
  href: string
}

type KontakFields = {
  address: string
  phone: string
  email: string
  hours: string
}

type BrandAsset = {
  path: string
  url: string
  bytes: number
  updated_at: string
}

type BrandAssets = {
  logo: BrandAsset | null
  favicon: BrandAsset | null
  faviconIco: BrandAsset | null
}

type Mode = "view" | "edit"

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

/** Nilai kosong tetap ditampilkan sebagai keterangan, bukan ruang hampa. */
function NilaiKosong() {
  return <span className="text-xs text-muted-foreground">Belum diisi</span>
}

function tautanSah(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

export default function StorefrontPlatformsEdit({
  title = "Profil & Kontak Toko",
  description = "Kelola tautan akun toko resmi di marketplace, media sosial, serta informasi kontak dan workshop.",
  platforms = [],
  submitUrl,
  kontakFields = { address: "", phone: "", email: "", hours: "" },
  kontakSubmitUrl,
  previewUrl,
  brandAssets = { logo: null, favicon: null, faviconIco: null },
  brandSubmitUrl,
}: {
  title?: string
  description?: string
  platforms?: PlatformRow[]
  submitUrl: string
  kontakFields?: KontakFields
  kontakSubmitUrl?: string
  previewUrl?: string
  brandAssets?: BrandAssets
  brandSubmitUrl: string
}) {
  // Kontrak UX: halaman dibuka dalam mode RINGKASAN (read-only). Isian baru
  // aktif setelah admin menekan tombol Edit, dan disimpan lewat tombol Simpan.
  const [mode, setMode] = React.useState<Mode>("view")
  const [saving, setSaving] = React.useState(false)
  // Slot aset mana yang sedang dibuka di MediaPicker (logo atau favicon).
  const [pickerTarget, setPickerTarget] = React.useState<"logo" | "favicon" | null>(null)

  const initialLinks = Object.fromEntries(platforms.map((p) => [p.key, p.href]))

  const platformForm = useForm<{ links: Record<string, string> }>({
    links: initialLinks,
  })

  const kontakForm = useForm<KontakFields>({
    address: kontakFields.address ?? "",
    phone: kontakFields.phone ?? "",
    email: kontakFields.email ?? "",
    hours: kontakFields.hours ?? "",
  })

  // Logo dan favicon hanya dikirim bila admin memilih berkas baru, supaya
  // menyimpan isian lain tidak menimpa aset yang sudah pas.
  const brandForm = useForm<{ logo_asset_id: string; favicon_asset_id: string }>({
    logo_asset_id: "",
    favicon_asset_id: "",
  })

  const marketplace = platforms.filter((p) => p.channel === "marketplace")
  const social = platforms.filter((p) => p.channel === "social")

  /**
   * Simpan seluruh isian halaman. Tautan, kontak, dan aset brand punya
   * endpoint sendiri-sendiri; permintaan dikirim berurutan dan berhenti pada
   * kegagalan pertama supaya tidak ada bagian yang tersimpan diam-diam saat
   * bagian lain gagal.
   */
  function submitAll(event?: React.FormEvent) {
    event?.preventDefault()
    if (saving) return
    setSaving(true)

    const selesai = () => {
      // Isian yang baru tersimpan dijadikan titik kembali, supaya tombol Batal
      // pada sesi edit berikutnya mengembalikan ke kondisi tersimpan, bukan ke
      // kondisi saat halaman pertama dimuat.
      platformForm.setDefaults()
      kontakForm.setDefaults()
      brandForm.setDefaults()
      setSaving(false)
      setMode("view")
    }

    const simpanAsetBrand = () => {
      if (!brandForm.data.logo_asset_id && !brandForm.data.favicon_asset_id) {
        selesai()
        return
      }

      brandForm.post(brandSubmitUrl, {
        preserveScroll: true,
        preserveState: true,
        onSuccess: selesai,
        onError: () => setSaving(false),
      })
    }

    platformForm.put(submitUrl, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        if (!kontakSubmitUrl) {
          simpanAsetBrand()
          return
        }

        kontakForm.put(kontakSubmitUrl, {
          preserveScroll: true,
          preserveState: true,
          onSuccess: simpanAsetBrand,
          onError: () => setSaving(false),
        })
      },
      onError: () => setSaving(false),
    })
  }

  function batal() {
    // Buang isian yang belum disimpan lalu tutup mode edit. router.reload()
    // sengaja TIDAK dipakai: reload mempertahankan state komponen, sehingga
    // mode edit ikut bertahan dan isian yang dibatalkan tetap tampil.
    platformForm.resetAndClearErrors()
    kontakForm.resetAndClearErrors()
    brandForm.resetAndClearErrors()
    setMode("view")
  }

  function setLink(key: string, value: string) {
    platformForm.setData("links", { ...platformForm.data.links, [key]: value })
  }

  /** Satu kartu tabel daftar platform (marketplace atau media sosial). */
  function kartuPlatform(
    heading: string,
    hint: string,
    rows: PlatformRow[],
    icon: string,
  ) {
    if (rows.length === 0) return null

    return (
      <SectionCard title={heading} description={hint} icon={icon} contentClassName="p-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-surface/80 text-left text-[11px] font-semibold text-muted-foreground">
              <th className="w-44 px-4 py-3">Platform</th>
              <th className="px-4 py-3">Tautan URL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.key} className="transition-colors hover:bg-muted/40">
                <td className="px-4 py-2.5 align-middle">
                  <div className="flex items-center gap-2.5">
                    {row.icon ? (
                      <img src={row.icon} alt="" className="size-6 shrink-0 object-contain" width={24} height={24} />
                    ) : (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon name="storefront" className="size-3.5" aria-hidden="true" />
                      </span>
                    )}
                    <span className="font-medium text-foreground">{row.label}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {mode === "edit" ? (
                    <Input
                      type="url"
                      inputMode="url"
                      placeholder={`https://... (${row.label})`}
                      value={platformForm.data.links[row.key] ?? ""}
                      onChange={(event) => setLink(row.key, event.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  ) : (platformForm.data.links[row.key] ?? "").trim() === "" ? (
                    <NilaiKosong />
                  ) : tautanSah(platformForm.data.links[row.key] ?? "") ? (
                    <a
                      href={platformForm.data.links[row.key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-mono text-xs text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
                    >
                      {platformForm.data.links[row.key]}
                    </a>
                  ) : (
                    <span className="break-all font-mono text-xs text-foreground">
                      {platformForm.data.links[row.key]}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    )
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => router.reload()}
            className="inline-flex items-center gap-1.5"
          >
            <Icon name="refresh" className="size-3.5" aria-hidden="true" />
            <span>Muat ulang</span>
          </Button>

          {previewUrl ? (
            <Button asChild variant="secondary" size="sm">
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5">
                <Icon name="storefront" className="size-3.5" aria-hidden="true" />
                <span>Lihat di toko</span>
              </a>
            </Button>
          ) : null}

          {mode === "view" ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setMode("edit")}
              className="inline-flex items-center gap-1.5"
            >
              <Icon name="pencil-simple" className="size-3.5" aria-hidden="true" />
              <span>Edit</span>
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={batal}>
                Batal
              </Button>
              <Button
                type="submit"
                form="storefront-profile-form"
                size="sm"
                disabled={saving}
                className="inline-flex items-center gap-1.5"
              >
                <Icon name="check" className="size-3.5" aria-hidden="true" />
                <span>{saving ? "Menyimpan..." : "Simpan"}</span>
              </Button>
            </>
          )}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      {/* Membentang penuh (kontrak panel admin: Table-First, bukan kartu sempit
          dengan ruang kosong di samping). */}
      <form id="storefront-profile-form" onSubmit={submitAll} className="w-full space-y-6">
        {/* 1. Marketplace & Media Sosial */}
        <div className="space-y-4">
          <FormErrorSummary errors={platformForm.errors} />
          <div className="grid items-start gap-6 lg:grid-cols-2">
            {kartuPlatform(
              "Marketplace Resmi",
              "Tautan toko resmi di platform belanja online. Tampil di kartu informasi toko dan footer.",
              marketplace,
              "storefront",
            )}
            {kartuPlatform(
              "Media Sosial Resmi",
              "Akun konten dan publikasi resmi toko (Instagram, TikTok, YouTube, Facebook).",
              social,
              "share",
            )}
          </div>
        </div>

        {/* 2. Kontak & Jam Kerja */}
        <div className="space-y-4">
          <FormErrorSummary errors={kontakForm.errors} />
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <SectionCard
              title="Informasi Kontak & Komunikasi"
              description="Saluran komunikasi utama untuk pembeli dan layanan pelanggan."
              icon="message-circle"
            >
              <div className="space-y-4">
                <Field
                  id="phone"
                  label="Nomor Telepon / WhatsApp Konsultasi"
                  error={kontakForm.errors.phone}
                  hint="Dipakai otomatis dari nomor WhatsApp yang tersambung di menu WhatsApp."
                >
                  {mode === "edit" ? (
                    <Input
                      id="phone"
                      value={kontakForm.data.phone}
                      onChange={(e) => kontakForm.setData("phone", e.target.value)}
                      placeholder="Terisi otomatis dari nomor WhatsApp yang tersambung"
                      className="font-mono text-xs bg-muted text-muted-foreground"
                      readOnly
                    />
                  ) : kontakForm.data.phone.trim() === "" ? (
                    <div className="flex min-h-9 items-center">
                      <NilaiKosong />
                    </div>
                  ) : (
                    <p className="flex min-h-9 items-center font-mono text-xs text-foreground">
                      {kontakForm.data.phone}
                    </p>
                  )}
                </Field>
                <Field id="email" label="Email Layanan Informasi (Opsional)" error={kontakForm.errors.email}>
                  {mode === "edit" ? (
                    <Input
                      id="email"
                      type="email"
                      value={kontakForm.data.email}
                      onChange={(e) => kontakForm.setData("email", e.target.value)}
                      placeholder="Contoh: info@ragilaluminium.com"
                      className="font-mono text-xs"
                    />
                  ) : kontakForm.data.email.trim() === "" ? (
                    <div className="flex min-h-9 items-center">
                      <NilaiKosong />
                    </div>
                  ) : (
                    <p className="flex min-h-9 items-center font-mono text-xs text-foreground">
                      {kontakForm.data.email}
                    </p>
                  )}
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              title="Lokasi Workshop & Jam Operasional"
              description="Alamat fisik workshop dan jadwal buka layanan pelanggan."
              icon="map-pin"
            >
              <div className="space-y-4">
                <Field id="address" label="Alamat Fisik Workshop / Toko" error={kontakForm.errors.address}>
                  {mode === "edit" ? (
                    <Textarea
                      id="address"
                      rows={3}
                      value={kontakForm.data.address}
                      onChange={(e) => kontakForm.setData("address", e.target.value)}
                      placeholder="Alamat lengkap workshop produksi dan kantor operasional"
                      className="text-xs leading-relaxed"
                    />
                  ) : kontakForm.data.address.trim() === "" ? (
                    <NilaiKosong />
                  ) : (
                    <p className="whitespace-pre-line text-xs leading-relaxed text-foreground">
                      {kontakForm.data.address}
                    </p>
                  )}
                </Field>
                <Field id="hours" label="Jam Operasional" error={kontakForm.errors.hours}>
                  {mode === "edit" ? (
                    <Input
                      id="hours"
                      value={kontakForm.data.hours}
                      onChange={(e) => kontakForm.setData("hours", e.target.value)}
                      placeholder="Contoh: Senin - Sabtu: 08.00 - 17.00 WIB (Minggu Libur)"
                      className="text-xs"
                    />
                  ) : kontakForm.data.hours.trim() === "" ? (
                    <div className="flex min-h-9 items-center">
                      <NilaiKosong />
                    </div>
                  ) : (
                    <p className="flex min-h-9 items-center text-xs text-foreground">{kontakForm.data.hours}</p>
                  )}
                </Field>
              </div>
            </SectionCard>
          </div>
        </div>

        {/* 3. Aset Brand */}
        <div className="space-y-4">
          <FormErrorSummary errors={brandForm.errors} />

          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            Logo dan favicon adalah identitas toko yang tampil di header situs,
            tab browser, dan ikon aplikasi di layar ponsel. Perubahan langsung
            terlihat setelah disimpan; muat ulang halaman bila ikon tab belum
            berganti karena browser menyimpannya cukup agresif.
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            {/* Logo */}
            <SectionCard
              title="Logo Toko"
              description="Tampil di header situs (tema terang dan gelap) dan footer. PNG transparan lebar minimal 300px disarankan."
              icon="image"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/20 p-4">
                  {brandAssets.logo ? (
                    <img
                      src={brandAssets.logo.url}
                      alt="Logo toko saat ini"
                      className="max-h-20 w-auto max-w-[180px] object-contain"
                      width={180}
                      height={80}
                    />
                  ) : (
                    <span className="flex h-20 w-[180px] items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                      Belum ada logo
                    </span>
                  )}
                  <div className="min-w-0 text-xs text-muted-foreground">
                    {brandAssets.logo ? (
                      <>
                        <p className="truncate font-medium text-foreground">{brandAssets.logo.path}</p>
                        <p className="mt-0.5">
                          {formatBytes(brandAssets.logo.bytes)} · diubah {brandAssets.logo.updated_at}
                        </p>
                      </>
                    ) : (
                      <p>Belum ada berkas logo terunggah.</p>
                    )}
                  </div>
                </div>

                {mode === "edit" ? (
                  <Field
                    id="brand-logo"
                    label="Ganti Logo dari Media Library"
                    error={brandForm.errors.logo_asset_id}
                    hint="Pilih aset logo (PNG transparan disarankan) dari Media Library, lalu tekan Simpan."
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setPickerTarget("logo")}
                      className="inline-flex w-fit items-center gap-1.5"
                    >
                      <Icon name="image" className="size-3.5" aria-hidden="true" />
                      <span>{brandForm.data.logo_asset_id ? "Ganti logo" : "Pilih logo"}</span>
                    </Button>
                  </Field>
                ) : null}
              </div>
            </SectionCard>

            {/* Favicon */}
            <SectionCard
              title="Favicon"
              description="Ikon di tab browser dan layar beranda ponsel. Disarankan PNG persegi minimal 180px."
              icon="image"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/20 p-4">
                  {brandAssets.favicon ? (
                    <img
                      src={brandAssets.favicon.url}
                      alt="Favicon saat ini"
                      className="size-16 shrink-0 rounded-md border border-border bg-surface object-contain p-1"
                      width={64}
                      height={64}
                    />
                  ) : (
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                      Kosong
                    </span>
                  )}
                  <div className="min-w-0 text-xs text-muted-foreground">
                    {brandAssets.faviconIco ? (
                      <>
                        <p className="truncate font-medium text-foreground">{brandAssets.faviconIco.path}</p>
                        <p className="mt-0.5">
                          {formatBytes(brandAssets.faviconIco.bytes)} · diubah {brandAssets.faviconIco.updated_at}
                        </p>
                        {brandAssets.favicon ? (
                          <p className="mt-0.5">PNG 32px tersedia untuk browser modern.</p>
                        ) : null}
                      </>
                    ) : (
                      <p>Belum ada favicon terunggah.</p>
                    )}
                  </div>
                </div>

                {mode === "edit" ? (
                  <Field
                    id="brand-favicon"
                    label="Ganti Favicon dari Media Library"
                    error={brandForm.errors.favicon_asset_id}
                    hint="Pilih aset favicon (ICO/PNG persegi) dari Media Library, lalu tekan Simpan."
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setPickerTarget("favicon")}
                      className="inline-flex w-fit items-center gap-1.5"
                    >
                      <Icon name="image" className="size-3.5" aria-hidden="true" />
                      <span>{brandForm.data.favicon_asset_id ? "Ganti favicon" : "Pilih favicon"}</span>
                    </Button>
                  </Field>
                ) : null}
              </div>
            </SectionCard>
          </div>
        </div>

        {mode === "view" ? (
          <p className="text-xs text-muted-foreground">
            Isi di atas adalah kondisi yang sedang aktif di toko. Tekan{" "}
            <strong className="font-semibold text-foreground">Edit</strong> untuk mengubah.
          </p>
        ) : null}
      </form>

      <MediaPicker
        open={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        multiple={false}
        kind="image"
        title={pickerTarget === "favicon" ? "Pilih Favicon Toko" : "Pilih Logo Toko"}
        onPick={(picked) => {
          const asset = picked[0]
          if (!asset) return
          if (pickerTarget === "favicon") {
            brandForm.setData("favicon_asset_id", String(asset.assetId))
          } else {
            brandForm.setData("logo_asset_id", String(asset.assetId))
          }
          setPickerTarget(null)
        }}
      />
    </AdminLayout>
  )
}
