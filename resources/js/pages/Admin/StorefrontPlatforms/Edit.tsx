import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"

type PlatformRow = {
  key: string
  label: string
  channel: "marketplace" | "social"
  icon: string | null
  href: string
}

type TabItem = {
  key: string
  label: string
  href: string
}

type KontakFields = {
  address: string
  phone: string
  email: string
  hours: string
}

export default function StorefrontPlatformsEdit({
  title = "Profil & Kontak Toko",
  description = "Kelola tautan akun toko resmi di marketplace, media sosial, serta informasi kontak dan workshop.",
  tab = "marketplace",
  tabs = [],
  platforms = [],
  submitUrl,
  kontakFields = { address: "", phone: "", email: "", hours: "" },
  kontakSubmitUrl,
  previewUrl,
}: {
  title?: string
  description?: string
  tab?: "marketplace" | "kontak"
  tabs?: TabItem[]
  platforms?: PlatformRow[]
  submitUrl: string
  kontakFields?: KontakFields
  kontakSubmitUrl?: string
  previewUrl?: string
}) {
  const initialLinks = Object.fromEntries(platforms.map((p) => [p.key, p.href]))

  // Form tab marketplace
  const platformForm = useForm<{ links: Record<string, string> }>({
    links: initialLinks,
  })

  // Form tab kontak
  const kontakForm = useForm<KontakFields>({
    address: kontakFields.address ?? "",
    phone: kontakFields.phone ?? "",
    email: kontakFields.email ?? "",
    hours: kontakFields.hours ?? "",
  })

  const marketplace = platforms.filter((p) => p.channel === "marketplace")
  const social = platforms.filter((p) => p.channel === "social")

  function submitPlatforms(event: React.FormEvent) {
    event.preventDefault()
    platformForm.put(submitUrl)
  }

  function submitKontak(event: React.FormEvent) {
    event.preventDefault()
    if (kontakSubmitUrl) {
      kontakForm.put(kontakSubmitUrl)
    }
  }

  function setLink(key: string, value: string) {
    platformForm.setData("links", { ...platformForm.data.links, [key]: value })
  }

  function renderPlatformTable(heading: string, hint: string, rows: PlatformRow[]) {
    if (rows.length === 0) return null

    return (
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border bg-muted/40 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">{heading}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-left text-[11px] font-semibold text-muted-foreground">
              <th className="w-44 px-4 py-2.5">Platform</th>
              <th className="px-4 py-2.5">Tautan URL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.key} className="transition-colors hover:bg-muted/10">
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
                  <Input
                    type="url"
                    inputMode="url"
                    placeholder={`https://... (${row.label})`}
                    value={platformForm.data.links[row.key] ?? ""}
                    onChange={(event) => setLink(row.key, event.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    )
  }

  const isKontakTab = tab === "kontak"
  const isProcessing = isKontakTab ? kontakForm.processing : platformForm.processing

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
            <span>Refresh data</span>
          </Button>
          {previewUrl ? (
            <Button asChild variant="secondary" size="sm">
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5">
                <Icon name="storefront" className="size-3.5" aria-hidden="true" />
                <span>Lihat di toko</span>
              </a>
            </Button>
          ) : null}
          <Button
            type="submit"
            form={isKontakTab ? "kontak-form" : "platforms-form"}
            size="sm"
            disabled={isProcessing}
          >
            {isProcessing ? "Menyimpan..." : "Simpan perubahan"}
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      {/* Segmented Tabs DS v2 */}
      {tabs.length > 0 ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-border bg-muted/60 p-1">
            {tabs.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all",
                  tab === item.key
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* Tab 1: Marketplace & Media Sosial */}
      {!isKontakTab ? (
        <form id="platforms-form" onSubmit={submitPlatforms} className="w-full space-y-6">
          <FormErrorSummary errors={platformForm.errors} />

          <div className="grid items-start gap-6 lg:grid-cols-2">
            {renderPlatformTable(
              "Marketplace Resmi",
              "Tautan toko resmi di platform belanja online. Tampil di kartu informasi toko dan footer.",
              marketplace,
            )}

            {renderPlatformTable(
              "Media Sosial Resmi",
              "Akun konten dan publikasi resmi toko (Instagram, TikTok, YouTube, Facebook).",
              social,
            )}
          </div>
        </form>
      ) : (
        /* Tab 2: Kontak & Jam Operasional */
        <form id="kontak-form" onSubmit={submitKontak} className="w-full space-y-6">
          <FormErrorSummary errors={kontakForm.errors} />

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Card className="space-y-4 p-5">
              <div className="border-b border-border pb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Informasi Kontak & Komunikasi
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Saluran komunikasi utama untuk pembeli dan layanan pelanggan.
                </p>
              </div>

              <Field id="phone" label="Nomor Telepon / WhatsApp Konsultasi" error={kontakForm.errors.phone}>
                <Input
                  id="phone"
                  value={kontakForm.data.phone}
                  onChange={(e) => kontakForm.setData("phone", e.target.value)}
                  placeholder="Contoh: 085725116817 atau 6285725116817"
                  className="font-mono text-xs"
                />
              </Field>

              <Field id="email" label="Email Layanan Informasi (Opsional)" error={kontakForm.errors.email}>
                <Input
                  id="email"
                  type="email"
                  value={kontakForm.data.email}
                  onChange={(e) => kontakForm.setData("email", e.target.value)}
                  placeholder="Contoh: info@ragilaluminium.com"
                  className="font-mono text-xs"
                />
              </Field>
            </Card>

            <Card className="space-y-4 p-5">
              <div className="border-b border-border pb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Lokasi Workshop & Jam Operasional
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Alamat fisik workshop dan jadwal buka layanan pelanggan.
                </p>
              </div>

              <Field id="address" label="Alamat Fisik Workshop / Toko" error={kontakForm.errors.address}>
                <Textarea
                  id="address"
                  rows={3}
                  value={kontakForm.data.address}
                  onChange={(e) => kontakForm.setData("address", e.target.value)}
                  placeholder="Alamat lengkap workshop produksi dan kantor operasional"
                  className="text-xs leading-relaxed"
                />
              </Field>

              <Field id="hours" label="Jam Operasional" error={kontakForm.errors.hours}>
                <Input
                  id="hours"
                  value={kontakForm.data.hours}
                  onChange={(e) => kontakForm.setData("hours", e.target.value)}
                  placeholder="Contoh: Senin - Sabtu: 08.00 - 17.00 WIB (Minggu Libur)"
                  className="text-xs"
                />
              </Field>
            </Card>
          </div>
        </form>
      )}
    </AdminLayout>
  )
}
