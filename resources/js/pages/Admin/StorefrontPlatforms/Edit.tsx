import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import { MediaPicker } from "@/components/admin/media-picker"
import { Badge } from "@/components/admin/ui/badge"
import { Button } from "@/components/admin/ui/button"
import { CopyButton } from "@/components/admin/ui/copy-button"
import { FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { SubmitGateButton } from "@/components/admin/ui/submit-gate-button"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { jagaGerbang } from "@/lib/submit-gate"

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

/** Nilai kosong tetap ditampilkan sebagai penanda jelas, bukan ruang hampa. */
function NilaiKosong() {
  return <span className="text-xs text-muted-foreground italic">Belum diisi</span>
}

function tautanSah(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

export default function StorefrontPlatformsEdit({
  title = "Profil & Kontak Toko",
  description = "Kelola identitas visual, kontak operasional, serta tautan akun resmi toko di marketplace dan media sosial.",
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
  const [mode, setMode] = React.useState<Mode>("view")
  const [saving, setSaving] = React.useState(false)
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

  const brandForm = useForm<{ logo_asset_id: string; favicon_asset_id: string }>({
    logo_asset_id: "",
    favicon_asset_id: "",
  })

  function submitAll(event?: React.FormEvent) {
    event?.preventDefault()
    if (saving) return
    setSaving(true)

    const selesai = () => {
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
    platformForm.resetAndClearErrors()
    kontakForm.resetAndClearErrors()
    brandForm.resetAndClearErrors()
    setMode("view")
  }

  function setLink(key: string, value: string) {
    platformForm.setData("links", { ...platformForm.data.links, [key]: value })
  }

  const gerbangForm = {
    data: platformForm.data,
    isDirty: platformForm.isDirty || kontakForm.isDirty || brandForm.isDirty,
    processing: saving,
  }

  const gerbang = {
    fields: { links: "Tautan" },
    requireChange: true,
  }

  const marketplaceRows = platforms.filter((p) => p.channel === "marketplace")
  const socialRows = platforms.filter((p) => p.channel === "social")

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
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
              <Button type="button" variant="secondary" size="sm" onClick={batal} disabled={saving}>
                Batal
              </Button>
              <SubmitGateButton
                form={gerbangForm}
                {...gerbang}
                formId="storefront-profile-form"
                size="sm"
                className="inline-flex items-center gap-1.5"
                processing={saving}
              >
                <>
                  <Icon name="check" className="size-3.5" aria-hidden="true" />
                  <span>{saving ? "Menyimpan..." : "Simpan"}</span>
                </>
              </SubmitGateButton>
            </>
          )}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <form id="storefront-profile-form" onSubmit={jagaGerbang(gerbang, gerbangForm, submitAll)} className="w-full space-y-4">
        <FormErrorSummary errors={{ ...platformForm.errors, ...kontakForm.errors, ...brandForm.errors }} />

        {/* Satu permukaan konten utama terpadu */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          
          {/* =====================================================================
              BAGIAN 1: IDENTITAS TOKO
              ===================================================================== */}
          <div className="border-b border-border bg-muted/40 px-4 py-3 sm:px-6">
            <h2 className="text-sm font-semibold text-foreground">Identitas Toko</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Logo dan favicon resmi untuk identitas visual etalase toko.
            </p>
          </div>

          <table className="w-full text-xs">
            <tbody className="divide-y divide-border">
              {/* Baris Logo */}
              <tr className="flex flex-col sm:table-row transition-colors hover:bg-muted/20">
                <th className="w-full sm:w-64 px-4 pt-3.5 pb-1 sm:py-4 sm:px-6 text-left align-top font-semibold text-foreground">
                  Logo Toko
                </th>
                <td className="w-full px-4 pb-3.5 pt-1 sm:py-4 sm:px-6 align-middle">
                  <div className="flex flex-wrap items-center gap-4">
                    {brandAssets.logo ? (
                      <div className="flex h-12 w-32 shrink-0 items-center justify-center rounded-md border border-border bg-surface p-1.5">
                        <img
                          src={brandAssets.logo.url}
                          alt="Logo toko saat ini"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <span className="flex h-12 w-32 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted text-xs text-muted-foreground">
                        Belum ada logo
                      </span>
                    )}

                    <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                      {brandAssets.logo ? (
                        <>
                          <p className="truncate font-mono text-xs text-foreground">{brandAssets.logo.path}</p>
                          <p className="mt-0.5 text-[11px]">
                            {formatBytes(brandAssets.logo.bytes)} · Diperbarui {brandAssets.logo.updated_at}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Disarankan format PNG transparan lebar minimal 300px.</p>
                      )}
                      {brandForm.data.logo_asset_id ? (
                        <p className="mt-1 text-[11px] font-medium text-primary">
                          Aset baru dipilih (ID: {brandForm.data.logo_asset_id}) · Belum disimpan
                        </p>
                      ) : null}
                    </div>

                    {mode === "edit" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setPickerTarget("logo")}
                        className="inline-flex shrink-0 items-center gap-1.5 text-xs"
                      >
                        <Icon name="image" className="size-3.5" aria-hidden="true" />
                        <span>{brandAssets.logo || brandForm.data.logo_asset_id ? "Ganti logo" : "Pilih logo"}</span>
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>

              {/* Baris Favicon */}
              <tr className="flex flex-col sm:table-row transition-colors hover:bg-muted/20">
                <th className="w-full sm:w-64 px-4 pt-3.5 pb-1 sm:py-4 sm:px-6 text-left align-top font-semibold text-foreground">
                  Favicon
                </th>
                <td className="w-full px-4 pb-3.5 pt-1 sm:py-4 sm:px-6 align-middle">
                  <div className="flex flex-wrap items-center gap-4">
                    {brandAssets.favicon ? (
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface p-1">
                        <img
                          src={brandAssets.favicon.url}
                          alt="Favicon saat ini"
                          className="size-6 object-contain"
                        />
                      </div>
                    ) : (
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted text-xs text-muted-foreground">
                        Kosong
                      </span>
                    )}

                    <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                      {brandAssets.faviconIco ? (
                        <>
                          <p className="truncate font-mono text-xs text-foreground">{brandAssets.faviconIco.path}</p>
                          <p className="mt-0.5 text-[11px]">
                            {formatBytes(brandAssets.faviconIco.bytes)} · Diperbarui {brandAssets.faviconIco.updated_at}
                          </p>
                        </>
                      ) : brandAssets.favicon ? (
                        <>
                          <p className="truncate font-mono text-xs text-foreground">{brandAssets.favicon.path}</p>
                          <p className="mt-0.5 text-[11px]">{formatBytes(brandAssets.favicon.bytes)}</p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Ikon tab browser (format ICO atau PNG persegi 32x32px).</p>
                      )}
                      {brandForm.data.favicon_asset_id ? (
                        <p className="mt-1 text-[11px] font-medium text-primary">
                          Aset baru dipilih (ID: {brandForm.data.favicon_asset_id}) · Belum disimpan
                        </p>
                      ) : null}
                    </div>

                    {mode === "edit" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setPickerTarget("favicon")}
                        className="inline-flex shrink-0 items-center gap-1.5 text-xs"
                      >
                        <Icon name="image" className="size-3.5" aria-hidden="true" />
                        <span>{brandAssets.favicon || brandForm.data.favicon_asset_id ? "Ganti favicon" : "Pilih favicon"}</span>
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* =====================================================================
              BAGIAN 2: KONTAK & OPERASIONAL
              ===================================================================== */}
          <div className="border-t border-b border-border bg-muted/40 px-4 py-3 sm:px-6">
            <h2 className="text-sm font-semibold text-foreground">Kontak & Operasional</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Saluran komunikasi pembeli, jadwal layanan, dan alamat workshop fisik.
            </p>
          </div>

          <table className="w-full text-xs">
            <tbody className="divide-y divide-border">
              {/* Nomor Telepon / WA */}
              <tr className="flex flex-col sm:table-row transition-colors hover:bg-muted/20">
                <th className="w-full sm:w-64 px-4 pt-3.5 pb-1 sm:py-4 sm:px-6 text-left align-top font-semibold text-foreground">
                  Telepon / WhatsApp
                </th>
                <td className="w-full px-4 pb-3.5 pt-1 sm:py-4 sm:px-6 align-middle">
                  {mode === "edit" ? (
                    <div className="space-y-1.5">
                      <Input
                        id="phone"
                        value={kontakForm.data.phone}
                        onChange={(e) => kontakForm.setData("phone", e.target.value)}
                        placeholder="Terisi otomatis dari nomor WhatsApp yang tersambung"
                        className="font-mono text-xs bg-muted text-muted-foreground max-w-md"
                        readOnly
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Dipakai otomatis dari nomor WhatsApp yang tersambung di menu WhatsApp.
                      </p>
                    </div>
                  ) : kontakForm.data.phone.trim() === "" ? (
                    <NilaiKosong />
                  ) : (
                    <div>
                      <span className="font-mono text-xs font-medium text-foreground">
                        {kontakForm.data.phone}
                      </span>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Tersambung otomatis dari integrasi WhatsApp.
                      </p>
                    </div>
                  )}
                </td>
              </tr>

              {/* Email Layanan */}
              <tr className="flex flex-col sm:table-row transition-colors hover:bg-muted/20">
                <th className="w-full sm:w-64 px-4 pt-3.5 pb-1 sm:py-4 sm:px-6 text-left align-top font-semibold text-foreground">
                  Email Layanan Informasi
                </th>
                <td className="w-full px-4 pb-3.5 pt-1 sm:py-4 sm:px-6 align-middle">
                  {mode === "edit" ? (
                    <Input
                      id="email"
                      type="email"
                      value={kontakForm.data.email}
                      onChange={(e) => kontakForm.setData("email", e.target.value)}
                      placeholder="Contoh: info@ragilaluminium.com"
                      className="font-mono text-xs max-w-md"
                    />
                  ) : kontakForm.data.email.trim() === "" ? (
                    <NilaiKosong />
                  ) : (
                    <span className="font-mono text-xs text-foreground">
                      {kontakForm.data.email}
                    </span>
                  )}
                </td>
              </tr>

              {/* Alamat Fisik */}
              <tr className="flex flex-col sm:table-row transition-colors hover:bg-muted/20">
                <th className="w-full sm:w-64 px-4 pt-3.5 pb-1 sm:py-4 sm:px-6 text-left align-top font-semibold text-foreground">
                  Alamat Workshop & Toko
                </th>
                <td className="w-full px-4 pb-3.5 pt-1 sm:py-4 sm:px-6 align-middle">
                  {mode === "edit" ? (
                    <Textarea
                      id="address"
                      rows={3}
                      value={kontakForm.data.address}
                      onChange={(e) => kontakForm.setData("address", e.target.value)}
                      placeholder="Alamat lengkap workshop produksi dan kantor operasional"
                      className="text-xs leading-relaxed max-w-2xl"
                    />
                  ) : kontakForm.data.address.trim() === "" ? (
                    <NilaiKosong />
                  ) : (
                    <p className="whitespace-pre-line text-xs leading-relaxed text-foreground max-w-2xl">
                      {kontakForm.data.address}
                    </p>
                  )}
                </td>
              </tr>

              {/* Jam Operasional */}
              <tr className="flex flex-col sm:table-row transition-colors hover:bg-muted/20">
                <th className="w-full sm:w-64 px-4 pt-3.5 pb-1 sm:py-4 sm:px-6 text-left align-top font-semibold text-foreground">
                  Jam Operasional
                </th>
                <td className="w-full px-4 pb-3.5 pt-1 sm:py-4 sm:px-6 align-middle">
                  {mode === "edit" ? (
                    <Input
                      id="hours"
                      value={kontakForm.data.hours}
                      onChange={(e) => kontakForm.setData("hours", e.target.value)}
                      placeholder="Contoh: Senin - Sabtu: 08.00 - 17.00 WIB (Minggu Libur)"
                      className="text-xs max-w-md"
                    />
                  ) : kontakForm.data.hours.trim() === "" ? (
                    <NilaiKosong />
                  ) : (
                    <span className="text-xs text-foreground">
                      {kontakForm.data.hours}
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          {/* =====================================================================
              BAGIAN 3: TAUTAN RESMI (MARKETPLACE & MEDIA SOSIAL DALAM SATU TABEL)
              ===================================================================== */}
          <div className="border-t border-b border-border bg-muted/40 px-4 py-3 sm:px-6">
            <h2 className="text-sm font-semibold text-foreground">Tautan Resmi</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tautan toko resmi di platform marketplace belanja online dan akun media sosial.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-left text-[11px] font-semibold text-muted-foreground">
                  <th className="w-48 px-4 py-3 sm:px-6">Platform</th>
                  <th className="w-32 px-4 py-3">Kanal</th>
                  <th className="px-4 py-3">Tautan URL</th>
                  {mode === "view" ? <th className="w-32 px-4 py-3 text-right sm:pr-6">Aksi</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Subjudul Kelompok Marketplace */}
                {marketplaceRows.length > 0 ? (
                  <tr className="bg-muted/30">
                    <td colSpan={mode === "view" ? 4 : 3} className="px-4 py-2 sm:px-6 text-xs font-semibold text-muted-foreground">
                      Marketplace Belanja Online
                    </td>
                  </tr>
                ) : null}
                {marketplaceRows.map((row) => {
                  const urlValue = platformForm.data.links[row.key] ?? ""
                  const hasUrl = urlValue.trim() !== ""
                  const isTautan = tautanSah(urlValue)

                  return (
                    <tr key={row.key} className="transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 sm:px-6 align-middle">
                        <div className="flex items-center gap-2.5">
                          {row.icon ? (
                            <img src={row.icon} alt="" className="size-5 shrink-0 object-contain" width={20} height={20} />
                          ) : (
                            <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                              <Icon name="storefront" className="size-3" aria-hidden="true" />
                            </span>
                          )}
                          <span className="font-medium text-foreground">{row.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Badge variant="secondary" className="font-normal text-[11px] px-2 py-0.5">
                          Marketplace
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {mode === "edit" ? (
                          <Input
                            type="url"
                            inputMode="url"
                            placeholder={`https://... (${row.label})`}
                            value={urlValue}
                            onChange={(event) => setLink(row.key, event.target.value)}
                            className="h-8 text-xs font-mono max-w-xl"
                          />
                        ) : !hasUrl ? (
                          <NilaiKosong />
                        ) : (
                          <span
                            className="inline-block max-w-[200px] sm:max-w-xs md:max-w-md lg:max-w-lg truncate font-mono text-xs text-foreground align-middle"
                            title={urlValue}
                          >
                            {urlValue}
                          </span>
                        )}
                      </td>
                      {mode === "view" ? (
                        <td className="px-4 py-3 text-right sm:pr-6 align-middle">
                          {hasUrl ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {isTautan ? (
                                <a
                                  href={urlValue}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                  title={`Buka ${row.label}`}
                                >
                                  <Icon name="external-link" className="size-3" aria-hidden="true" />
                                  <span>Buka</span>
                                </a>
                              ) : null}
                              <CopyButton text={urlValue} label={`Salin URL ${row.label}`} compact />
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}

                {/* Subjudul Kelompok Media Sosial */}
                {socialRows.length > 0 ? (
                  <tr className="bg-muted/30">
                    <td colSpan={mode === "view" ? 4 : 3} className="px-4 py-2 sm:px-6 text-xs font-semibold text-muted-foreground">
                      Media Sosial Resmi
                    </td>
                  </tr>
                ) : null}
                {socialRows.map((row) => {
                  const urlValue = platformForm.data.links[row.key] ?? ""
                  const hasUrl = urlValue.trim() !== ""
                  const isTautan = tautanSah(urlValue)

                  return (
                    <tr key={row.key} className="transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 sm:px-6 align-middle">
                        <div className="flex items-center gap-2.5">
                          {row.icon ? (
                            <img src={row.icon} alt="" className="size-5 shrink-0 object-contain" width={20} height={20} />
                          ) : (
                            <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                              <Icon name="share" className="size-3" aria-hidden="true" />
                            </span>
                          )}
                          <span className="font-medium text-foreground">{row.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Badge variant="outline" className="font-normal text-[11px] px-2 py-0.5 text-muted-foreground">
                          Media Sosial
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {mode === "edit" ? (
                          <Input
                            type="url"
                            inputMode="url"
                            placeholder={`https://... (${row.label})`}
                            value={urlValue}
                            onChange={(event) => setLink(row.key, event.target.value)}
                            className="h-8 text-xs font-mono max-w-xl"
                          />
                        ) : !hasUrl ? (
                          <NilaiKosong />
                        ) : (
                          <span
                            className="inline-block max-w-[200px] sm:max-w-xs md:max-w-md lg:max-w-lg truncate font-mono text-xs text-foreground align-middle"
                            title={urlValue}
                          >
                            {urlValue}
                          </span>
                        )}
                      </td>
                      {mode === "view" ? (
                        <td className="px-4 py-3 text-right sm:pr-6 align-middle">
                          {hasUrl ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {isTautan ? (
                                <a
                                  href={urlValue}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                  title={`Buka ${row.label}`}
                                >
                                  <Icon name="external-link" className="size-3" aria-hidden="true" />
                                  <span>Buka</span>
                                </a>
                              ) : null}
                              <CopyButton text={urlValue} label={`Salin URL ${row.label}`} compact />
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

        </div>
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
