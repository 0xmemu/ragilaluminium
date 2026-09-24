import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import { MediaPicker } from "@/components/admin/media-picker"
import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"

interface WhyPoint {
  icon: string
  title: string
  body: string
}

interface WorkStep {
  title: string
  body: string
}

interface StatItem {
  value: string
  label: string
  description: string
}

interface GalleryItem {
  media_asset_id?: number | null
  url: string
  title: string
  caption: string
}

interface ProcessItem {
  icon: string
  title: string
  description: string
  image_url?: string | null
}

interface PageData {
  hero_title: string
  hero_subtitle: string
  hero_tagline: string
  hero_headline: string
  hero_description: string
  main_image_url: string
  main_media_asset_id: number | null
  gallery_items: GalleryItem[]
  stats_items: StatItem[]
  why_points: WhyPoint[]
  production_processes: ProcessItem[]
  work_steps: WorkStep[]
  trust_rows: string[]
  google_maps_url: string
  google_maps_embed_url: string
}

interface ContactData {
  address: string
  phone: string
  email: string
  hours: string
}

interface PlatformItem {
  key: string
  label: string
  channel: string
  icon: string | null
  href: string
}

export default function TentangKamiEdit({
  title,
  description,
  page,
  contact,
  platforms = [],
  iconOptions = [],
  submitUrl,
  previewUrl,
}: {
  title: string
  description: string
  page: PageData
  contact: ContactData
  platforms: PlatformItem[]
  iconOptions: Array<{ value: string; label: string }>
  submitUrl: string
  previewUrl: string
}) {
  // Kontrak UX: menu dibuka dalam mode RINGKASAN (read-only). Form baru
  // aktif setelah admin menekan tombol "Edit profil".
  const [mode, setMode] = React.useState<"view" | "edit">("view")
  const [pickerMode, setPickerMode] = React.useState<"main" | "gallery" | null>(null)

  const initialPlatformMap: Record<string, string> = {}
  platforms.forEach((p) => {
    initialPlatformMap[p.key] = p.href || ""
  })

  const form = useForm({
    hero_title: page.hero_title ?? "",
    hero_subtitle: page.hero_subtitle ?? "",
    hero_tagline: page.hero_tagline ?? "",
    hero_headline: page.hero_headline ?? "",
    hero_description: page.hero_description ?? "",
    main_image_url: page.main_image_url ?? "",
    main_media_asset_id: page.main_media_asset_id ?? null,
    gallery_items: page.gallery_items ?? [],
    stats_items: page.stats_items ?? [],
    why_points: page.why_points ?? [],
    production_processes: page.production_processes ?? [],
    work_steps: page.work_steps ?? [],
    trust_rows: page.trust_rows ?? [],
    google_maps_url: page.google_maps_url ?? "",
    google_maps_embed_url: page.google_maps_embed_url ?? "",
    contact: {
      address: contact.address ?? "",
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      hours: contact.hours ?? "",
    },
    platforms: initialPlatformMap,
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.put(submitUrl, {
      preserveScroll: true,
      onSuccess: () => setMode("view"),
    })
  }

  function addWhyPoint() {
    if (form.data.why_points.length >= 6) return
    form.setData("why_points", [
      ...form.data.why_points,
      { icon: "storefront", title: "", body: "" },
    ])
  }

  function updateWhyPoint(index: number, patch: Partial<WhyPoint>) {
    const next = [...form.data.why_points]
    next[index] = { ...next[index], ...patch }
    form.setData("why_points", next)
  }

  function removeWhyPoint(index: number) {
    form.setData(
      "why_points",
      form.data.why_points.filter((_, i) => i !== index),
    )
  }

  function addTrustRow() {
    form.setData("trust_rows", [...form.data.trust_rows, ""])
  }

  function updateTrustRow(index: number, val: string) {
    const next = [...form.data.trust_rows]
    next[index] = val
    form.setData("trust_rows", next)
  }

  function removeTrustRow(index: number) {
    form.setData(
      "trust_rows",
      form.data.trust_rows.filter((_, i) => i !== index),
    )
  }

  function moveTrustRow(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= form.data.trust_rows.length) return
    const next = [...form.data.trust_rows]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    form.setData("trust_rows", next)
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {mode === "view" ? (
            <>
              {previewUrl ? (
                <Button asChild variant="secondary" size="sm">
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5">
                    <Icon name="storefront" className="size-3.5" aria-hidden="true" />
                    <span>Lihat di toko</span>
                  </a>
                </Button>
              ) : null}
              <Button type="button" size="sm" onClick={() => setMode("edit")}>
                <Icon name="pencil-simple" className="size-3.5" aria-hidden="true" />
                Edit profil
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={() => setMode("view")}>
                Batal
              </Button>
              {previewUrl ? (
                <Button asChild variant="secondary" size="sm">
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5">
                    <Icon name="storefront" className="size-3.5" aria-hidden="true" />
                    <span>Lihat di toko</span>
                  </a>
                </Button>
              ) : null}
              <Button type="submit" form="about-profile-form" size="sm" disabled={form.processing}>
                {form.processing ? "Menyimpan..." : "Simpan"}
              </Button>
            </>
          )}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      {/* Mode RINGKASAN: profil tampil read-only seperti kartu informasi, tanpa form */}
      {mode === "view" ? (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-base font-bold tracking-tight text-foreground">
                    {form.data.hero_title || "Ragil Aluminium"}
                  </span>
                  {form.data.hero_subtitle ? (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                      {form.data.hero_subtitle}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 max-w-2xl text-sm font-semibold leading-snug text-foreground">
                  {form.data.hero_headline}
                </p>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                  {form.data.hero_description}
                </p>
              </div>
              {form.data.main_image_url ? (
                <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-md border border-border">
                  <img src={form.data.main_image_url} alt="Foto utama" className="size-full object-cover" />
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <Icon name="sparkle" className="size-3.5" aria-hidden="true" />
                Statistik Utama
              </h2>
              <dl className="mt-3 space-y-2">
                {form.data.stats_items.map((stat, index) => (
                  <div key={index} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 last:border-0">
                    <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                    <dd className="text-sm font-bold tabular-nums text-foreground">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <Icon name="map-pin" className="size-3.5" aria-hidden="true" />
                Kontak &amp; Lokasi
              </h2>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="border-b border-border/60 pb-2">
                  <dt className="text-muted-foreground">Alamat</dt>
                  <dd className="mt-0.5 leading-5 text-foreground">{form.data.contact.address || "-"}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-border/60 pb-2">
                  <dt className="text-muted-foreground">Telepon/WA</dt>
                  <dd className="font-medium text-foreground">{form.data.contact.phone || "-"}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-border/60 pb-2">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="font-medium text-foreground">{form.data.contact.email || "-"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Jam Operasional</dt>
                  <dd className="font-medium text-foreground">{form.data.contact.hours || "-"}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <Icon name="check-circle" className="size-3.5" aria-hidden="true" />
                Keunggulan ({form.data.why_points.length})
              </h2>
              <ul className="mt-3 space-y-2">
                {form.data.why_points.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                      <Icon name={point.icon || "check-circle"} className="size-3.5" weight="bold" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">{point.title}</span>
                      <span className="block leading-4 text-muted-foreground">{point.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <Icon name="wrench" className="size-3.5" aria-hidden="true" />
                Proses Produksi ({form.data.production_processes.length})
              </h2>
              <ul className="mt-3 space-y-2">
                {form.data.production_processes.map((proc, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                      <Icon name={proc.icon || "storefront"} className="size-3.5" weight="bold" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">{proc.title}</span>
                      <span className="block leading-4 text-muted-foreground">{proc.description}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <Icon name="check" className="size-3.5" aria-hidden="true" />
                Cara Kerja ({form.data.work_steps.length} langkah)
              </h2>
              <ol className="mt-3 space-y-2">
                {form.data.work_steps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs">
                    <span className="font-bold tabular-nums text-primary">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">{step.title}</span>
                      <span className="block leading-4 text-muted-foreground">{step.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 md:col-span-2">
              <h2 className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <Icon name="share" className="size-3.5" aria-hidden="true" />
                Media Sosial &amp; Marketplace
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {platforms
                  .filter((p) => (form.data.platforms[p.key] ?? "") !== "")
                  .map((p) => (
                    <a
                      key={p.key}
                      href={form.data.platforms[p.key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-foreground/25 hover:bg-muted/60"
                    >
                      {p.icon ? (
                        <img src={p.icon} alt="" className="size-4 object-contain" width={16} height={16} />
                      ) : null}
                      {p.label}
                    </a>
                  ))}
                {platforms.every((p) => (form.data.platforms[p.key] ?? "") === "") ? (
                  <span className="text-xs text-muted-foreground">Belum ada tautan platform aktif.</span>
                ) : null}
              </div>
              {form.data.gallery_items.length ? (
                <>
                  <h2 className="mt-4 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                    <Icon name="image" className="size-3.5" aria-hidden="true" />
                    Galeri Workshop ({form.data.gallery_items.length})
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {form.data.gallery_items.map((item, index) => (
                      <div key={index} className="relative h-16 w-20 overflow-hidden rounded-md border border-border">
                        <img src={item.url} alt={item.title || `Foto ${index + 1}`} className="size-full object-cover" />
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Profil di atas adalah kondisi yang sedang aktif di toko. Tekan{" "}
            <strong className="font-semibold text-foreground">Edit profil</strong> untuk mengubah.
          </p>
        </div>
      ) : (
        <form id="about-profile-form" onSubmit={submit} className="w-full space-y-6">
          <FormErrorSummary errors={form.errors} />

          {/* Seksi 1: Informasi Utama */}
          <SectionCard
            title="1. Informasi Utama Website"
            description="Identitas, tagline, headline, dan pengenalan profil yang tampil pada area hero toko."
            icon="info"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="hero_title"
                label="Judul Utama Website"
                error={form.errors.hero_title}
                hint="Nama usaha atau judul profil utama (mis. Ragil Aluminium)."
              >
                <Input
                  value={form.data.hero_title}
                  onChange={(e) => form.setData("hero_title", e.target.value)}
                  placeholder="Ragil Aluminium"
                  maxLength={120}
                />
              </Field>

              <Field
                id="hero_subtitle"
                label="Subjudul / Tagline Singkat"
                error={form.errors.hero_subtitle}
                hint="Label ringkas penanda identitas (mis. Sejak 2008)."
              >
                <Input
                  value={form.data.hero_subtitle}
                  onChange={(e) => form.setData("hero_subtitle", e.target.value)}
                  placeholder="Sejak 2008"
                  maxLength={120}
                />
              </Field>

              <div className="sm:col-span-2">
                <Field
                  id="hero_headline"
                  label="Kalimat Utama / Headline Bisnis"
                  error={form.errors.hero_headline}
                  hint="Pesan utama yang langsung menarik perhatian pelanggan tentang keunggulan produk Anda."
                >
                  <Input
                    value={form.data.hero_headline}
                    onChange={(e) => form.setData("hero_headline", e.target.value)}
                    placeholder="Spesialis Jendela & Pintu Aluminium Siap Pasang Berkualitas"
                    maxLength={320}
                  />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field
                  id="hero_description"
                  label="Deskripsi Singkat Perusahaan"
                  error={form.errors.hero_description}
                  hint="Penjelasan mengenai perusahaan, produk, kualitas, jangkauan layanan, dan komitmen bisnis."
                >
                  <Textarea
                    rows={3}
                    value={form.data.hero_description}
                    onChange={(e) => form.setData("hero_description", e.target.value)}
                    placeholder="Jelaskan profil workshop, pengerjaan presisi, dan komitmen layanan Anda..."
                    maxLength={2000}
                  />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <div className="rounded-lg border border-dashed border-border bg-card p-4">
                  <p className="text-[10px] font-semibold text-muted-foreground">
                    Pratinjau hero toko (persis seperti di halaman Tentang Kami)
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold tracking-tight text-foreground">
                      {form.data.hero_title || "Ragil Aluminium"}
                    </span>
                    {form.data.hero_subtitle ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                        {form.data.hero_subtitle}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-bold leading-snug text-foreground">
                    {form.data.hero_headline || "Headline utama toko"}
                  </p>
                  <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
                    {form.data.hero_description || "Deskripsi singkat perusahaan akan tampil di sini."}
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Seksi 2: Informasi Kontak dan Lokasi */}
          <SectionCard
            title="2. Informasi Kontak & Lokasi"
            description="Informasi kontak resmi, jam operasional, dan lokasi Google Maps toko/workshop. Otomatis sinkron ke halaman /contact dan footer."
            icon="map-pin"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  id="contact_address"
                  label="Alamat Lengkap Toko / Workshop"
                  hint="Alamat fisik workshop atau kantor untuk kunjungan pelanggan dan pengiriman."
                >
                  <Textarea
                    rows={2}
                    value={form.data.contact.address}
                    onChange={(e) =>
                      form.setData("contact", { ...form.data.contact, address: e.target.value })
                    }
                    placeholder="Jl. Raya Mandiraja No. ..., Banjarnegara, Jawa Tengah"
                  />
                </Field>
              </div>

              <Field
                id="contact_phone"
                label="Nomor Telepon / WhatsApp"
                hint="Dipakai otomatis dari nomor WhatsApp yang tersambung di menu WhatsApp. Bila bot tidak tersambung, nomor terakhir yang pernah tersambung tetap dipakai."
              >
                <Input
                  value={form.data.contact.phone}
                  placeholder="Terisi otomatis dari nomor WhatsApp yang tersambung"
                  className="font-mono text-xs bg-muted text-muted-foreground"
                  readOnly
                />
              </Field>

              <Field
                id="contact_email"
                label="Email Bisnis"
                hint="Alamat email resmi untuk penawaran dan pertanyaan proyek."
              >
                <Input
                  type="email"
                  value={form.data.contact.email}
                  onChange={(e) =>
                    form.setData("contact", { ...form.data.contact, email: e.target.value })
                  }
                  placeholder="kontak@ragilaluminium.com"
                />
              </Field>

              <Field
                id="contact_hours"
                label="Jam Operasional"
                hint="Hari dan jam buka layanan toko (mis. Senin - Sabtu, 08.00 - 17.00 WIB)."
              >
                <Input
                  value={form.data.contact.hours}
                  onChange={(e) =>
                    form.setData("contact", { ...form.data.contact, hours: e.target.value })
                  }
                  placeholder="Senin - Sabtu, 08.00 - 17.00 WIB"
                />
              </Field>

              <Field
                id="google_maps_url"
                label="URL Tautan Google Maps"
                error={form.errors.google_maps_url}
                hint="Tautan untuk membuka rute lokasi toko di aplikasi Google Maps."
              >
                <Input
                  type="url"
                  value={form.data.google_maps_url}
                  onChange={(e) => form.setData("google_maps_url", e.target.value)}
                  placeholder="https://maps.app.goo.gl/..."
                />
              </Field>

              <div className="sm:col-span-2">
                <Field
                  id="google_maps_embed_url"
                  label="URL Iframe Embed Google Maps"
                  error={form.errors.google_maps_embed_url}
                  hint="URL embed peta interaktif untuk ditampilkan langsung di halaman Tentang Kami."
                >
                  <Input
                    value={form.data.google_maps_embed_url}
                    onChange={(e) => form.setData("google_maps_embed_url", e.target.value)}
                    placeholder="https://www.google.com/maps/embed?..."
                  />
                </Field>
              </div>

              {form.data.google_maps_embed_url ? (
                <div className="sm:col-span-2 overflow-hidden rounded-lg border border-border">
                  <iframe
                    src={form.data.google_maps_embed_url}
                    title="Pratinjau Peta Google Maps"
                    loading="lazy"
                    className="h-44 w-full border-0"
                  />
                </div>
              ) : null}
            </div>
          </SectionCard>

          {/* Seksi 3: Foto dan Media */}
          <SectionCard
            title="3. Foto & Media Dokumentasi"
            description="Foto utama profil toko serta dokumentasi visual workshop, proses perakitan, dan produk real (maksimal 4 foto galeri)."
            icon="image"
          >
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="relative aspect-[4/3] w-full max-w-[200px] shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
                    {form.data.main_image_url ? (
                      <img src={form.data.main_image_url} alt="Foto Utama" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full flex-col items-center justify-center text-muted-foreground">
                        <Icon name="image" className="size-8" aria-hidden="true" />
                        <span className="mt-1 text-[11px]">Belum ada foto</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-foreground">
                      Foto Utama Perusahaan
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Foto display atau depan workshop. Ditampilkan pada hero halaman Tentang Kami.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button type="button" variant="secondary" size="sm" onClick={() => setPickerMode("main")}>
                        <Icon name="upload" className="size-3.5" aria-hidden="true" />
                        {form.data.main_image_url ? "Ganti foto utama" : "Pilih foto utama"}
                      </Button>
                      {form.data.main_image_url ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => form.setData({ ...form.data, main_image_url: "", main_media_asset_id: null })}
                        >
                          Hapus foto
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-foreground">
                      Foto Galeri Workshop &amp; Produksi ({form.data.gallery_items.length}/4)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Dokumentasi aktivitas perakitan, mesin pemotong, dan hasil pengerjaan tim.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={form.data.gallery_items.length >= 4}
                    onClick={() => setPickerMode("gallery")}
                  >
                    <Icon name="plus" className="size-3.5" aria-hidden="true" />
                    Tambah
                  </Button>
                </div>

                {form.data.gallery_items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border py-8 text-center">
                    <Icon name="camera" className="mx-auto size-7 text-muted-foreground/60" aria-hidden="true" />
                    <p className="mt-2 text-xs font-medium text-foreground">Belum ada foto galeri workshop</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Unggah atau pilih foto dari Media Library untuk memberikan gambaran nyata fasilitas Anda.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {form.data.gallery_items.map((item, index) => (
                      <div key={index} className="rounded-lg border border-border bg-surface p-2.5 space-y-2">
                        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-surface-muted">
                          <img src={item.url} alt="" className="size-full object-cover" />
                          <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            Foto {index + 1}
                          </span>
                        </div>
                        <Input
                          value={item.title}
                          onChange={(e) => {
                            const next = [...form.data.gallery_items]
                            next[index] = { ...next[index], title: e.target.value }
                            form.setData("gallery_items", next)
                          }}
                          placeholder="Judul foto..."
                          className="h-8 text-xs"
                        />
                        <Input
                          value={item.caption}
                          onChange={(e) => {
                            const next = [...form.data.gallery_items]
                            next[index] = { ...next[index], caption: e.target.value }
                            form.setData("gallery_items", next)
                          }}
                          placeholder="Keterangan..."
                          className="h-8 text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full text-destructive hover:text-destructive text-xs"
                          onClick={() => {
                            form.setData("gallery_items", form.data.gallery_items.filter((_, i) => i !== index))
                          }}
                        >
                          <Icon name="trash-2" className="size-3.5" aria-hidden="true" />
                          Hapus foto
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Seksi 4: Statistik Utama */}
          <SectionCard
            title="4. Statistik Utama"
            description="4 kartu ringkasan keunggulan toko. Menampilkan angka dan nilai riil yang sedang aktif di website."
            icon="sparkle"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {form.data.stats_items.map((stat, index) => (
                <div key={index} className="rounded-lg border border-border bg-surface p-3.5 space-y-2">
                  <span className="text-[11px] font-bold text-primary">
                    Kartu {index + 1}
                  </span>
                  <Field id={`stat_val_${index}`} label="Nilai / Angka Singkat">
                    <Input
                      value={stat.value}
                      onChange={(e) => {
                        const next = [...form.data.stats_items]
                        next[index] = { ...next[index], value: e.target.value }
                        form.setData("stats_items", next)
                      }}
                      placeholder="mis. 1.800+"
                      className="h-8 text-xs font-bold"
                    />
                  </Field>
                  <Field id={`stat_lbl_${index}`} label="Label / Keterangan">
                    <Input
                      value={stat.label}
                      onChange={(e) => {
                        const next = [...form.data.stats_items]
                        next[index] = { ...next[index], label: e.target.value }
                        form.setData("stats_items", next)
                      }}
                      placeholder="mis. Variasi Ukuran & Model"
                      className="h-8 text-xs font-semibold"
                    />
                  </Field>
                  <Field id={`stat_desc_${index}`} label="Catatan Tambahan (Opsional)">
                    <Input
                      value={stat.description}
                      onChange={(e) => {
                        const next = [...form.data.stats_items]
                        next[index] = { ...next[index], description: e.target.value }
                        form.setData("stats_items", next)
                      }}
                      placeholder="mis. Pilihan terlengkap"
                      className="h-8 text-xs text-muted-foreground"
                    />
                  </Field>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Seksi 5: Keunggulan Toko */}
          <SectionCard
            title="5. Keunggulan Toko (Kenapa Memilih Ragil Aluminium?)"
            description="Kartu nilai jual utama dengan ikon resmi. Tampil pada grid 4 kolom di halaman Tentang Kami."
            icon="check-circle"
          >
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {form.data.why_points.map((point, index) => (
                  <div key={index} className="rounded-lg border border-border bg-surface p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="flex size-7 items-center justify-center rounded bg-primary/10 text-primary">
                        <Icon name={point.icon || "check-circle"} className="size-4" weight="bold" aria-hidden="true" />
                      </span>
                      {form.data.why_points.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs text-destructive hover:text-destructive"
                          onClick={() => removeWhyPoint(index)}
                        >
                          Hapus
                        </Button>
                      ) : null}
                    </div>
                    <Field id={`why_icon_${index}`} label="Ikon">
                      <Select
                        value={point.icon}
                        onChange={(e) => updateWhyPoint(index, { icon: e.target.value })}
                        className="h-8 text-xs"
                      >
                        {iconOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field id={`why_title_${index}`} label="Judul Keunggulan">
                      <Input
                        value={point.title}
                        onChange={(e) => updateWhyPoint(index, { title: e.target.value })}
                        placeholder="mis. Produksi sendiri"
                        className="h-8 text-xs font-semibold"
                      />
                    </Field>
                    <Field id={`why_body_${index}`} label="Keterangan">
                      <Textarea
                        rows={2}
                        value={point.body}
                        onChange={(e) => updateWhyPoint(index, { body: e.target.value })}
                        placeholder="Penjelasan keunggulan..."
                        className="text-xs"
                      />
                    </Field>
                    <div className="rounded-md border border-dashed border-border bg-card p-2.5">
                      <p className="text-[9px] font-semibold text-muted-foreground">
                        Pratinjau kartu
                      </p>
                      <span className="mt-1.5 flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon name={point.icon || "check-circle"} className="size-4" weight="bold" aria-hidden="true" />
                      </span>
                      <p className="mt-1.5 text-xs font-bold text-foreground">
                        {point.title || "Judul keunggulan"}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                        {point.body || "Penjelasan tampil di sini."}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {form.data.why_points.length < 6 ? (
                <Button type="button" variant="secondary" size="sm" onClick={addWhyPoint}>
                  <Icon name="plus" className="size-3.5" aria-hidden="true" />
                  Tambah
                </Button>
              ) : null}
            </div>
          </SectionCard>

          {/* Seksi 6: Kepercayaan Pelanggan */}
          <SectionCard
            title="6. Kepercayaan Pelanggan (Dipercaya Banyak Pelanggan)"
            description="Daftar poin klaim layanan dan jaminan pelanggan. Setiap poin dapat diedit, dipindahkan posisinya, dan ditambah."
            icon="shield-check"
          >
            <div className="space-y-3">
              <div className="space-y-2">
                {form.data.trust_rows.map((row, index) => (
                  <div key={index} className="flex items-center gap-2 rounded-md border border-border bg-surface p-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                      <Icon name="check-circle" className="size-4" weight="bold" aria-hidden="true" />
                    </span>
                    <Input
                      value={row}
                      onChange={(e) => updateTrustRow(index, e.target.value)}
                      placeholder="Tulis poin jaminan / klaim layanan..."
                      className="h-8 flex-1 text-xs"
                    />
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0"
                        disabled={index === 0}
                        onClick={() => moveTrustRow(index, -1)}
                        title="Pindah ke atas"
                      >
                        <Icon name="caret-up" className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0"
                        disabled={index === form.data.trust_rows.length - 1}
                        onClick={() => moveTrustRow(index, 1)}
                        title="Pindah ke bawah"
                      >
                        <Icon name="caret-down" className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0 text-destructive hover:text-destructive"
                        disabled={form.data.trust_rows.length <= 1}
                        onClick={() => removeTrustRow(index)}
                        title="Hapus baris"
                      >
                        <Icon name="trash-2" className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {form.data.trust_rows.length < 6 ? (
                <Button type="button" variant="secondary" size="sm" onClick={addTrustRow}>
                  <Icon name="plus" className="size-3.5" aria-hidden="true" />
                  Tambah
                </Button>
              ) : null}
            </div>
          </SectionCard>

          {/* Seksi 7: Proses Produksi */}
          <SectionCard
            title="7. Proses & Standar Produksi"
            description="Kartu tahapan atau kondisi produksi perusahaan (Workshop Mandiri, Pengerjaan Tenaga Ahli, Produk Real) dengan ikon dan deskripsi singkat."
            icon="wrench"
          >
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                {form.data.production_processes.map((proc, index) => (
                  <div key={index} className="rounded-lg border border-border bg-surface p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-primary">
                        Tahap {index + 1}
                      </span>
                      {form.data.production_processes.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs text-destructive hover:text-destructive"
                          onClick={() => {
                            form.setData(
                              "production_processes",
                              form.data.production_processes.filter((_, i) => i !== index),
                            )
                          }}
                        >
                          Hapus
                        </Button>
                      ) : null}
                    </div>
                    <Field id={`proc_icon_${index}`} label="Pilih Ikon">
                      <Select
                        value={proc.icon}
                        onChange={(e) => {
                          const next = [...form.data.production_processes]
                          next[index] = { ...next[index], icon: e.target.value }
                          form.setData("production_processes", next)
                        }}
                        className="h-8 text-xs"
                      >
                        {iconOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field id={`proc_title_${index}`} label="Judul Proses">
                      <Input
                        value={proc.title}
                        onChange={(e) => {
                          const next = [...form.data.production_processes]
                          next[index] = { ...next[index], title: e.target.value }
                          form.setData("production_processes", next)
                        }}
                        placeholder="mis. Workshop Mandiri"
                        className="h-8 text-xs font-semibold"
                      />
                    </Field>
                    <Field id={`proc_desc_${index}`} label="Deskripsi">
                      <Textarea
                        rows={2}
                        value={proc.description}
                        onChange={(e) => {
                          const next = [...form.data.production_processes]
                          next[index] = { ...next[index], description: e.target.value }
                          form.setData("production_processes", next)
                        }}
                        placeholder="Penjelasan tahapan..."
                        className="text-xs"
                      />
                    </Field>
                    <div className="rounded-md border border-dashed border-border bg-card p-2.5">
                      <p className="text-[9px] font-semibold text-muted-foreground">
                        Pratinjau kartu
                      </p>
                      <span className="mt-1.5 flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon name={proc.icon || "storefront"} className="size-4" weight="bold" aria-hidden="true" />
                      </span>
                      <p className="mt-1.5 text-xs font-bold text-foreground">
                        {proc.title || "Judul proses"}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                        {proc.description || "Penjelasan tampil di sini."}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {form.data.production_processes.length < 4 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    form.setData("production_processes", [
                      ...form.data.production_processes,
                      { icon: "storefront", title: "", description: "" },
                    ])
                  }}
                >
                  <Icon name="plus" className="size-3.5" aria-hidden="true" />
                  Tambah
                </Button>
              ) : null}
            </div>
          </SectionCard>

          {/* Seksi 8: Cara Kerja Kami */}
          <SectionCard
            title="8. Cara Kerja Kami (Alur Pemesanan)"
            description="Tahapan alur belanja atau pemesanan sederhana (misal: 01 Pilih Produk, 02 Konfirmasi WA, 03 Pengiriman)."
            icon="check-circle"
          >
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                {form.data.work_steps.map((step, index) => (
                  <div key={index} className="rounded-lg border border-border bg-surface p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary tabular-nums">
                        Langkah {String(index + 1).padStart(2, "0")}
                      </span>
                      {form.data.work_steps.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs text-destructive hover:text-destructive"
                          onClick={() => {
                            form.setData(
                              "work_steps",
                              form.data.work_steps.filter((_, i) => i !== index),
                            )
                          }}
                        >
                          Hapus
                        </Button>
                      ) : null}
                    </div>
                    <Field id={`step_title_${index}`} label="Judul Langkah">
                      <Input
                        value={step.title}
                        onChange={(e) => {
                          const next = [...form.data.work_steps]
                          next[index] = { ...next[index], title: e.target.value }
                          form.setData("work_steps", next)
                        }}
                        placeholder="mis. Pilih Produk"
                        className="h-8 text-xs font-semibold"
                      />
                    </Field>
                    <Field id={`step_body_${index}`} label="Penjelasan">
                      <Textarea
                        rows={2}
                        value={step.body}
                        onChange={(e) => {
                          const next = [...form.data.work_steps]
                          next[index] = { ...next[index], body: e.target.value }
                          form.setData("work_steps", next)
                        }}
                        placeholder="Pelanggan memilih model..."
                        className="text-xs"
                      />
                    </Field>
                    <div className="rounded-md border border-dashed border-border bg-card p-2.5">
                      <p className="text-[9px] font-semibold text-muted-foreground">
                        Pratinjau langkah
                      </p>
                      <span className="mt-1 block text-lg font-bold tabular-nums text-primary">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <p className="mt-0.5 text-xs font-bold text-foreground">
                        {step.title || "Judul langkah"}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                        {step.body || "Penjelasan tampil di sini."}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {form.data.work_steps.length < 4 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    form.setData("work_steps", [
                      ...form.data.work_steps,
                      { title: "", body: "" },
                    ])
                  }}
                >
                  <Icon name="plus" className="size-3.5" aria-hidden="true" />
                  Tambah
                </Button>
              ) : null}
            </div>
          </SectionCard>

          {/* Seksi 9: Media Sosial */}
          <SectionCard
            title="9. Akun Media Sosial Resmi"
            description="Tautan akun media sosial perusahaan untuk berinteraksi dan melihat aktivitas proyek (Instagram, TikTok, Facebook, YouTube)."
            icon="share"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/ragilaluminium29" },
                { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@jendelaragilaluminium" },
                { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/ragilaluminium29" },
                { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@ragilaluminium29" },
              ].map((soc) => (
                <Field key={soc.key} id={`platform_${soc.key}`} label={soc.label}>
                  <div className="flex items-center gap-2">
                    <Input
                      type="url"
                      value={form.data.platforms[soc.key] ?? ""}
                      onChange={(e) =>
                        form.setData("platforms", { ...form.data.platforms, [soc.key]: e.target.value })
                      }
                      placeholder={soc.placeholder}
                      className="h-8 text-xs"
                    />
                    {form.data.platforms[soc.key] ? (
                      <a
                        href={form.data.platforms[soc.key]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title={`Buka ${soc.label}`}
                      >
                        <Icon name="arrow-up-right" className="size-3.5" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                </Field>
              ))}
            </div>
          </SectionCard>

          {/* Seksi 10: Toko Online & Marketplace */}
          <SectionCard
            title="10. Toko Online & Marketplace Resmi"
            description="Tautan toko resmi di berbagai platform marketplace (Shopee, Tokopedia, TikTok Shop, Lazada). Otomatis tampil di footer dan halaman profil."
            icon="storefront"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { key: "shopee", label: "Shopee", placeholder: "https://shopee.co.id/..." },
                { key: "tokopedia", label: "Tokopedia", placeholder: "https://tokopedia.com/..." },
                { key: "tiktok_shop", label: "TikTok Shop", placeholder: "https://shop.tiktok.com/..." },
                { key: "lazada", label: "Lazada", placeholder: "https://lazada.co.id/shop/..." },
              ].map((mkt) => (
                <Field key={mkt.key} id={`platform_${mkt.key}`} label={mkt.label}>
                  <div className="flex items-center gap-2">
                    <Input
                      type="url"
                      value={form.data.platforms[mkt.key] ?? ""}
                      onChange={(e) =>
                        form.setData("platforms", { ...form.data.platforms, [mkt.key]: e.target.value })
                      }
                      placeholder={mkt.placeholder}
                      className="h-8 text-xs"
                    />
                    {form.data.platforms[mkt.key] ? (
                      <a
                        href={form.data.platforms[mkt.key]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title={`Buka ${mkt.label}`}
                      >
                        <Icon name="arrow-up-right" className="size-3.5" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                </Field>
              ))}
            </div>
          </SectionCard>

          {/* Tombol Simpan & Batal Bawah */}
          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="secondary" onClick={() => setMode("view")}>
              Batal
            </Button>
            <Button type="submit" disabled={form.processing}>
              {form.processing ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      )}

      {/* Modal Pemilih Media: Foto Utama */}
      <MediaPicker
        open={pickerMode === "main"}
        onClose={() => setPickerMode(null)}
        multiple={false}
        title="Pilih Foto Utama Perusahaan"
        onPick={(picked) => {
          if (picked.length > 0) {
            form.setData({
              ...form.data,
              main_media_asset_id: picked[0].assetId,
              main_image_url: picked[0].thumbUrl,
            })
          }
          setPickerMode(null)
        }}
      />

      {/* Modal Pemilih Media: Foto Galeri Workshop */}
      <MediaPicker
        open={pickerMode === "gallery"}
        onClose={() => setPickerMode(null)}
        multiple={true}
        title="Pilih Foto Galeri Workshop & Produksi"
        onPick={(picked) => {
          const next = [...form.data.gallery_items]
          for (const item of picked) {
            if (next.length >= 4) break
            next.push({
              media_asset_id: item.assetId,
              url: item.thumbUrl,
              title: item.label,
              caption: "",
            })
          }
          form.setData("gallery_items", next)
          setPickerMode(null)
        }}
      />
    </AdminLayout>
  )
}
