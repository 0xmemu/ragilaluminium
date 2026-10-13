import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import { MediaPicker } from "@/components/admin/media-picker"
import { SectionCard } from "@/components/admin/section-card"
import { Badge } from "@/components/admin/ui/badge"
import { Button } from "@/components/admin/ui/button"
import { Field, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableScroll } from "@/components/admin/ui/table"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"

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

type TabKey = "hero" | "stats_points" | "process_steps" | "contact_social"

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
  // Kontrak UX (ADR-023): menu dibuka dalam mode RINGKASAN (read-only).
  // Form baru aktif setelah admin menekan tombol "Edit profil".
  const [mode, setMode] = React.useState<"view" | "edit">("view")
  const [activeTab, setActiveTab] = React.useState<TabKey>("hero")
  const [pickerMode, setPickerMode] = React.useState<"main" | "gallery" | null>(null)

  // Inline edit state untuk tabel interaktif
  const [editingWhyIndex, setEditingWhyIndex] = React.useState<number | null>(null)
  const [editingProcessIndex, setEditingProcessIndex] = React.useState<number | null>(null)
  const [editingStepIndex, setEditingStepIndex] = React.useState<number | null>(null)

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
      onSuccess: () => {
        setMode("view")
        setEditingWhyIndex(null)
        setEditingProcessIndex(null)
        setEditingStepIndex(null)
      },
    })
  }

  function addWhyPoint() {
    if (form.data.why_points.length >= 6) return
    const newItems = [
      ...form.data.why_points,
      { icon: "check-circle", title: "", body: "" },
    ]
    form.setData("why_points", newItems)
    setEditingWhyIndex(newItems.length - 1)
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
    if (editingWhyIndex === index) setEditingWhyIndex(null)
  }

  function addTrustRow() {
    if (form.data.trust_rows.length >= 6) return
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

  function addProductionProcess() {
    if (form.data.production_processes.length >= 4) return
    const newProcesses = [
      ...form.data.production_processes,
      { icon: "storefront", title: "", description: "" },
    ]
    form.setData("production_processes", newProcesses)
    setEditingProcessIndex(newProcesses.length - 1)
  }

  function updateProductionProcess(index: number, patch: Partial<ProcessItem>) {
    const next = [...form.data.production_processes]
    next[index] = { ...next[index], ...patch }
    form.setData("production_processes", next)
  }

  function removeProductionProcess(index: number) {
    form.setData(
      "production_processes",
      form.data.production_processes.filter((_, i) => i !== index),
    )
    if (editingProcessIndex === index) setEditingProcessIndex(null)
  }

  function addWorkStep() {
    if (form.data.work_steps.length >= 4) return
    const newSteps = [
      ...form.data.work_steps,
      { title: "", body: "" },
    ]
    form.setData("work_steps", newSteps)
    setEditingStepIndex(newSteps.length - 1)
  }

  function updateWorkStep(index: number, patch: Partial<WorkStep>) {
    const next = [...form.data.work_steps]
    next[index] = { ...next[index], ...patch }
    form.setData("work_steps", next)
  }

  function removeWorkStep(index: number) {
    form.setData(
      "work_steps",
      form.data.work_steps.filter((_, i) => i !== index),
    )
    if (editingStepIndex === index) setEditingStepIndex(null)
  }

  const tabs: Array<{ key: TabKey; label: string; icon: string; count?: number }> = [
    { key: "hero", label: "Hero & Media", icon: "image" },
    { key: "stats_points", label: "Statistik & Keunggulan", icon: "sparkle", count: form.data.why_points.length },
    { key: "process_steps", label: "Proses & Cara Kerja", icon: "wrench", count: form.data.work_steps.length },
    { key: "contact_social", label: "Kontak & Tautan Toko", icon: "map-pin" },
  ]

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
                <Icon name="pencil-simple" className="size-3.5 mr-1" aria-hidden="true" />
                Edit profil
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setMode("view")
                  setEditingWhyIndex(null)
                  setEditingProcessIndex(null)
                  setEditingStepIndex(null)
                }}
              >
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

      {/* =====================================================================
          MODE RINGKASAN (VIEW MODE / READ-ONLY) - SESUAI KONTRAK ADR-023
          ===================================================================== */}
      {mode === "view" ? (
        <div className="space-y-6">
          {/* Header Banner Profil Hero */}
          <div className="overflow-hidden rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    {form.data.hero_title || "Ragil Aluminium"}
                  </h2>
                  {form.data.hero_subtitle ? (
                    <Badge variant="secondary" className="bg-primary/10 text-primary font-semibold">
                      {form.data.hero_subtitle}
                    </Badge>
                  ) : null}
                </div>
                <p className="max-w-3xl text-sm font-semibold leading-snug text-foreground">
                  {form.data.hero_headline || "Spesialis Kusen, Jendela & Pintu Aluminium Berkualitas"}
                </p>
                <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
                  {form.data.hero_description || "Belum ada deskripsi profil perusahaan."}
                </p>
              </div>

              {form.data.main_image_url ? (
                <div className="relative h-28 w-40 shrink-0 overflow-hidden rounded-lg border border-border bg-muted shadow-2xs">
                  <img src={form.data.main_image_url} alt="Foto utama" className="size-full object-cover" />
                </div>
              ) : (
                <div className="flex h-28 w-40 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground">
                  <Icon name="image" className="size-8 opacity-40" aria-hidden="true" />
                  <span className="mt-1 text-[11px]">Belum ada foto</span>
                </div>
              )}
            </div>
          </div>

          {/* Grid Informasi Utama */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Kartu Statistik Toko */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="flex items-center gap-2 text-xs font-bold tracking-tight text-muted-foreground">
                  <Icon name="sparkle" className="size-4 text-primary" aria-hidden="true" />
                  Statistik Utama
                </h3>
                <span className="text-xs text-muted-foreground font-medium">{form.data.stats_items.length} kartu</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {form.data.stats_items.map((stat, index) => (
                  <div key={index} className="rounded-lg border border-border/80 bg-muted/20 p-3 text-center">
                    <span className="block text-base font-bold tabular-nums text-foreground">{stat.value || "-"}</span>
                    <span className="mt-1 block text-[11px] font-semibold text-foreground/90">{stat.label}</span>
                    {stat.description ? (
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">{stat.description}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {/* Kartu Kontak & Lokasi */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="flex items-center gap-2 text-xs font-bold tracking-tight text-muted-foreground">
                  <Icon name="map-pin" className="size-4 text-primary" aria-hidden="true" />
                  Kontak Resmi & Lokasi
                </h3>
              </div>
              <dl className="mt-3 space-y-2.5 text-xs">
                <div className="border-b border-border/40 pb-2">
                  <dt className="text-muted-foreground">Alamat Toko</dt>
                  <dd className="mt-0.5 font-medium leading-relaxed text-foreground">{form.data.contact.address || "-"}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-border/40 pb-2">
                  <dt className="text-muted-foreground">Telepon / WhatsApp</dt>
                  <dd className="font-mono font-medium text-foreground">{form.data.contact.phone || "-"}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-border/40 pb-2">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="font-medium text-foreground">{form.data.contact.email || "-"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Jam Operasional</dt>
                  <dd className="font-medium text-foreground">{form.data.contact.hours || "-"}</dd>
                </div>
              </dl>
            </div>

            {/* Keunggulan Toko */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="flex items-center gap-2 text-xs font-bold tracking-tight text-muted-foreground">
                  <Icon name="check-circle" className="size-4 text-primary" aria-hidden="true" />
                  Keunggulan ({form.data.why_points.length})
                </h3>
              </div>
              <ul className="mt-3 divide-y divide-border/40">
                {form.data.why_points.map((point, index) => (
                  <li key={index} className="flex items-start gap-3 py-2.5 first:pt-1 last:pb-0 text-xs">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon name={point.icon || "check-circle"} className="size-4" weight="bold" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <span className="block font-semibold text-foreground">{point.title}</span>
                      <span className="mt-0.5 block leading-relaxed text-muted-foreground">{point.body}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Proses & Cara Kerja */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="flex items-center gap-2 text-xs font-bold tracking-tight text-muted-foreground">
                  <Icon name="wrench" className="size-4 text-primary" aria-hidden="true" />
                  Standar Produksi & Alur
                </h3>
                <span className="text-xs text-muted-foreground font-medium">{form.data.work_steps.length} langkah</span>
              </div>
              <div className="mt-3 space-y-4">
                <div>
                  <h4 className="text-[11px] font-bold text-muted-foreground tracking-tight mb-2">Proses Produksi</h4>
                  <div className="grid gap-2">
                    {form.data.production_processes.map((proc, index) => (
                      <div key={index} className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                          <Icon name={proc.icon || "storefront"} className="size-3.5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <span className="font-semibold text-foreground">{proc.title}</span>
                          <p className="mt-0.5 text-muted-foreground line-clamp-1">{proc.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-bold text-muted-foreground tracking-tight mb-2">Alur Pemesanan</h4>
                  <ol className="space-y-1.5 text-xs">
                    {form.data.work_steps.map((step, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="font-bold tabular-nums text-primary">{String(index + 1).padStart(2, "0")}.</span>
                        <span className="min-w-0">
                          <strong className="text-foreground">{step.title}</strong>
                          <span className="text-muted-foreground"> - {step.body}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            {/* Galeri & Media Sosial */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6 md:col-span-2">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 space-y-3">
                  <h3 className="flex items-center gap-2 text-xs font-bold tracking-tight text-muted-foreground">
                    <Icon name="share" className="size-4 text-primary" aria-hidden="true" />
                    Media Sosial & Marketplace
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {platforms
                      .filter((p) => (form.data.platforms[p.key] ?? "") !== "")
                      .map((p) => (
                        <a
                          key={p.key}
                          href={form.data.platforms[p.key]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-foreground/30 hover:bg-muted/60"
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
                </div>

                {form.data.gallery_items.length ? (
                  <div className="space-y-3 lg:max-w-md">
                    <h3 className="flex items-center gap-2 text-xs font-bold tracking-tight text-muted-foreground">
                      <Icon name="image" className="size-4 text-primary" aria-hidden="true" />
                      Galeri Workshop ({form.data.gallery_items.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {form.data.gallery_items.map((item, index) => (
                        <div key={index} className="relative h-16 w-20 overflow-hidden rounded-md border border-border bg-muted">
                          <img src={item.url} alt={item.title || `Foto ${index + 1}`} className="size-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* =====================================================================
           MODE EDIT: FORM TERSTRUKTUR DENGAN TAB NAVIGASI & TABLE-FIRST
           ===================================================================== */
        <form id="about-profile-form" onSubmit={submit} className="w-full space-y-6">
          <FormErrorSummary errors={form.errors} />

          {/* Tab Navigasi Seksi Form */}
          <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
            {tabs.map((tab) => {
              const active = tab.key === activeTab
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon name={tab.icon} className="size-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                        active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          {/* TAB 1: HERO & MEDIA DOKUMENTASI */}
          {activeTab === "hero" ? (
            <div className="space-y-6">
              <SectionCard
                title="Informasi Hero & Profil Utama"
                description="Identitas, tagline, headline, dan pengenalan profil yang tampil pada banner hero toko."
                icon="info"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="hero_title"
                    label="Judul Utama Website"
                    error={form.errors.hero_title}
                    hint="Nama profil usaha utama (contoh: Ragil Aluminium)."
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
                    label="Subjudul / Tagline Ringkas"
                    error={form.errors.hero_subtitle}
                    hint="Label penanda pengalaman bisnis (contoh: Sejak 2008)."
                  >
                    <Input
                      value={form.data.hero_subtitle}
                      onChange={(e) => form.setData("hero_subtitle", e.target.value)}
                      placeholder="Sejak 2008"
                      maxLength={120}
                    />
                  </Field>

                  <Field
                    id="hero_headline"
                    label="Headline / Kalimat Penarik"
                    error={form.errors.hero_headline}
                    hint="Pesan utama keunggulan toko yang langsung dilihat calon pembeli."
                    className="sm:col-span-2"
                  >
                    <Input
                      value={form.data.hero_headline}
                      onChange={(e) => form.setData("hero_headline", e.target.value)}
                      placeholder="Spesialis Jendela & Pintu Aluminium Siap Pasang Berkualitas"
                      maxLength={320}
                    />
                  </Field>

                  <Field
                    id="hero_description"
                    label="Deskripsi Profil Perusahaan"
                    error={form.errors.hero_description}
                    hint="Penjelasan visi workshop, material berkualitas, jangkauan pengiriman, dan komitmen layanan."
                    className="sm:col-span-2"
                  >
                    <Textarea
                      rows={3}
                      value={form.data.hero_description}
                      onChange={(e) => form.setData("hero_description", e.target.value)}
                      placeholder="Jelaskan sejarah workshop, pengerjaan presisi, dan komitmen pelayanan toko..."
                      maxLength={2000}
                    />
                  </Field>
                </div>
              </SectionCard>

              {/* Media Utama & Galeri Workshop */}
              <SectionCard
                title="Foto Utama & Galeri Workshop"
                description="Foto display utama profil toko serta dokumentasi visual bengkel dan hasil pengerjaan (maksimal 4 foto galeri)."
                icon="image"
              >
                <div className="space-y-6">
                  {/* Foto Utama */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="relative aspect-[4/3] w-full max-w-[200px] shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                        {form.data.main_image_url ? (
                          <img src={form.data.main_image_url} alt="Foto Utama" className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full flex-col items-center justify-center text-muted-foreground">
                            <Icon name="image" className="size-8 opacity-40" aria-hidden="true" />
                            <span className="mt-1 text-[11px]">Belum ada foto</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-foreground">
                          Foto Utama Perusahaan
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Foto display atau tampak depan workshop. Ditampilkan pada hero halaman Tentang Kami.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Button type="button" variant="secondary" size="xs" onClick={() => setPickerMode("main")}>
                            <Icon name="upload" className="size-3.5 mr-1" aria-hidden="true" />
                            {form.data.main_image_url ? "Ganti foto utama" : "Pilih foto utama"}
                          </Button>
                          {form.data.main_image_url ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              className="text-destructive hover:text-destructive"
                              onClick={() => form.setData({ ...form.data, main_image_url: "", main_media_asset_id: null })}
                            >
                              Hapus foto
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Galeri Workshop */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">
                          Foto Galeri Workshop ({form.data.gallery_items.length}/4)
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Dokumentasi fasilitas, proses potong, dan perakitan tim.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        disabled={form.data.gallery_items.length >= 4}
                        onClick={() => setPickerMode("gallery")}
                      >
                        <Icon name="plus" className="size-3.5 mr-1" aria-hidden="true" />
                        Tambah foto
                      </Button>
                    </div>

                    {form.data.gallery_items.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border py-8 text-center bg-muted/10">
                        <Icon name="camera" className="mx-auto size-7 text-muted-foreground/60" aria-hidden="true" />
                        <p className="mt-2 text-xs font-medium text-foreground">Belum ada foto galeri workshop</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Pilih foto dari Media Library untuk melengkapi profil workshop Anda.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {form.data.gallery_items.map((item, index) => (
                          <div key={index} className="rounded-lg border border-border bg-card p-3 space-y-2">
                            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-muted">
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
                              className="h-7 text-xs"
                            />
                            <Input
                              value={item.caption}
                              onChange={(e) => {
                                const next = [...form.data.gallery_items]
                                next[index] = { ...next[index], caption: e.target.value }
                                form.setData("gallery_items", next)
                              }}
                              placeholder="Keterangan..."
                              className="h-7 text-xs"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              className="w-full text-destructive hover:text-destructive text-xs"
                              onClick={() => {
                                form.setData("gallery_items", form.data.gallery_items.filter((_, i) => i !== index))
                              }}
                            >
                              <Icon name="trash-2" className="size-3.5 mr-1" aria-hidden="true" />
                              Hapus
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : null}

          {/* TAB 2: STATISTIK & KEUNGGULAN (TABLE-FIRST) */}
          {activeTab === "stats_points" ? (
            <div className="space-y-6">
              {/* Statistik Utama */}
              <SectionCard
                title="Kartu Statistik Utama Toko"
                description="4 ringkasan angka keunggulan toko yang tampil mencolok di profil."
                icon="sparkle"
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {form.data.stats_items.map((stat, index) => (
                    <div key={index} className="rounded-lg border border-border bg-card p-4 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                        <span className="text-[11px] font-bold text-primary">Kartu {index + 1}</span>
                      </div>
                      <Field id={`stat_val_${index}`} label="Nilai / Angka">
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
                      <Field id={`stat_lbl_${index}`} label="Label">
                        <Input
                          value={stat.label}
                          onChange={(e) => {
                            const next = [...form.data.stats_items]
                            next[index] = { ...next[index], label: e.target.value }
                            form.setData("stats_items", next)
                          }}
                          placeholder="mis. Pilihan Model"
                          className="h-8 text-xs font-semibold"
                        />
                      </Field>
                      <Field id={`stat_desc_${index}`} label="Keterangan">
                        <Input
                          value={stat.description}
                          onChange={(e) => {
                            const next = [...form.data.stats_items]
                            next[index] = { ...next[index], description: e.target.value }
                            form.setData("stats_items", next)
                          }}
                          placeholder="mis. Terlengkap"
                          className="h-8 text-xs text-muted-foreground"
                        />
                      </Field>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Tabel Keunggulan Toko (Table-First dengan Inline Edit) */}
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3 sm:px-6">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Daftar Keunggulan Toko</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Poin nilai jual utama yang meyakinkan pelanggan ({form.data.why_points.length} dari maks 6 poin).
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    disabled={form.data.why_points.length >= 6}
                    onClick={addWhyPoint}
                  >
                    <Icon name="plus" className="size-3.5 mr-1" aria-hidden="true" />
                    Tambah keunggulan
                  </Button>
                </div>

                <TableScroll>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20 text-[11px] font-semibold text-muted-foreground">
                        <TableHead className="w-12 text-center">No</TableHead>
                        <TableHead className="w-36">Ikon</TableHead>
                        <TableHead className="w-56">Judul Keunggulan</TableHead>
                        <TableHead>Penjelasan / Keterangan</TableHead>
                        <TableHead className="w-32 text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.data.why_points.map((point, index) => {
                        const isEditing = editingWhyIndex === index

                        if (isEditing) {
                          return (
                            <TableRow key={index} className="bg-muted/10">
                              <TableCell colSpan={5} className="p-4 sm:p-6">
                                <div className="rounded-lg border border-primary/30 bg-card p-4 shadow-xs">
                                  <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3.5">
                                    <span className="text-xs font-bold text-foreground">
                                      Edit Keunggulan #{index + 1}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="xs"
                                      onClick={() => setEditingWhyIndex(null)}
                                    >
                                      Selesai edit
                                    </Button>
                                  </div>
                                  <FieldGrid>
                                    <Field id={`edit_why_icon_${index}`} label="Ikon">
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
                                    <Field id={`edit_why_title_${index}`} label="Judul Keunggulan" required>
                                      <Input
                                        value={point.title}
                                        onChange={(e) => updateWhyPoint(index, { title: e.target.value })}
                                        placeholder="mis. Produksi Mandiri"
                                        className="h-8 text-xs font-semibold"
                                      />
                                    </Field>
                                    <Field id={`edit_why_body_${index}`} label="Penjelasan" className="sm:col-span-2">
                                      <Textarea
                                        rows={2}
                                        value={point.body}
                                        onChange={(e) => updateWhyPoint(index, { body: e.target.value })}
                                        placeholder="Jelaskan alasan keunggulan ini..."
                                        className="text-xs"
                                      />
                                    </Field>
                                  </FieldGrid>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        }

                        return (
                          <TableRow key={index} className="hover:bg-muted/20">
                            <TableCell className="text-center font-mono text-muted-foreground font-medium">
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="flex size-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                                  <Icon name={point.icon || "check-circle"} className="size-4" weight="bold" aria-hidden="true" />
                                </span>
                                <span className="text-xs text-muted-foreground">{point.icon}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold text-foreground text-xs">
                              {point.title || <span className="text-muted-foreground italic">Belum ada judul</span>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground leading-relaxed">
                              {point.body || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => setEditingWhyIndex(index)}
                                >
                                  Edit
                                </Button>
                                {form.data.why_points.length > 1 ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => removeWhyPoint(index)}
                                  >
                                    Hapus
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableScroll>
              </div>

              {/* Poin Jaminan & Kepercayaan Pelanggan */}
              <SectionCard
                title="Poin Jaminan Kepercayaan Pelanggan"
                description="Klaim layanan dan jaminan garansi belanja (bisa digeser urutannya, maksimal 6 baris)."
                icon="shield-check"
              >
                <div className="space-y-3">
                  <div className="space-y-2">
                    {form.data.trust_rows.map((row, index) => (
                      <div key={index} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                          <Icon name="check-circle" className="size-4" weight="bold" aria-hidden="true" />
                        </span>
                        <Input
                          value={row}
                          onChange={(e) => updateTrustRow(index, e.target.value)}
                          placeholder="Tulis poin garansi / komitmen kepuasan pembeli..."
                          className="h-8 flex-1 text-xs"
                        />
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="size-7 p-0"
                            disabled={index === 0}
                            onClick={() => moveTrustRow(index, -1)}
                            title="Geser ke atas"
                          >
                            <Icon name="caret-up" className="size-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="size-7 p-0"
                            disabled={index === form.data.trust_rows.length - 1}
                            onClick={() => moveTrustRow(index, 1)}
                            title="Geser ke bawah"
                          >
                            <Icon name="caret-down" className="size-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
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
                    <Button type="button" variant="secondary" size="xs" onClick={addTrustRow}>
                      <Icon name="plus" className="size-3.5 mr-1" aria-hidden="true" />
                      Tambah baris jaminan
                    </Button>
                  ) : null}
                </div>
              </SectionCard>
            </div>
          ) : null}

          {/* TAB 3: PROSES PRODUKSI & CARA KERJA (TABLE-FIRST) */}
          {activeTab === "process_steps" ? (
            <div className="space-y-6">
              {/* Tabel Standar Proses Produksi */}
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3 sm:px-6">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Tahapan Proses Produksi</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Kondisi workshop dan standar mutu perakitan aluminium ({form.data.production_processes.length} dari maks 4 tahap).
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    disabled={form.data.production_processes.length >= 4}
                    onClick={addProductionProcess}
                  >
                    <Icon name="plus" className="size-3.5 mr-1" aria-hidden="true" />
                    Tambah proses
                  </Button>
                </div>

                <TableScroll>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20 text-[11px] font-semibold text-muted-foreground">
                        <TableHead className="w-12 text-center">No</TableHead>
                        <TableHead className="w-36">Ikon</TableHead>
                        <TableHead className="w-56">Judul Proses</TableHead>
                        <TableHead>Deskripsi Tahapan</TableHead>
                        <TableHead className="w-32 text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.data.production_processes.map((proc, index) => {
                        const isEditing = editingProcessIndex === index

                        if (isEditing) {
                          return (
                            <TableRow key={index} className="bg-muted/10">
                              <TableCell colSpan={5} className="p-4 sm:p-6">
                                <div className="rounded-lg border border-primary/30 bg-card p-4 shadow-xs">
                                  <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3.5">
                                    <span className="text-xs font-bold text-foreground">
                                      Edit Tahap Produksi #{index + 1}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="xs"
                                      onClick={() => setEditingProcessIndex(null)}
                                    >
                                      Selesai edit
                                    </Button>
                                  </div>
                                  <FieldGrid>
                                    <Field id={`edit_proc_icon_${index}`} label="Ikon">
                                      <Select
                                        value={proc.icon}
                                        onChange={(e) => updateProductionProcess(index, { icon: e.target.value })}
                                        className="h-8 text-xs"
                                      >
                                        {iconOptions.map((opt) => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                      </Select>
                                    </Field>
                                    <Field id={`edit_proc_title_${index}`} label="Judul Proses" required>
                                      <Input
                                        value={proc.title}
                                        onChange={(e) => updateProductionProcess(index, { title: e.target.value })}
                                        placeholder="mis. Workshop Mandiri"
                                        className="h-8 text-xs font-semibold"
                                      />
                                    </Field>
                                    <Field id={`edit_proc_desc_${index}`} label="Deskripsi" className="sm:col-span-2">
                                      <Textarea
                                        rows={2}
                                        value={proc.description}
                                        onChange={(e) => updateProductionProcess(index, { description: e.target.value })}
                                        placeholder="Penjelasan tahapan produksi..."
                                        className="text-xs"
                                      />
                                    </Field>
                                  </FieldGrid>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        }

                        return (
                          <TableRow key={index} className="hover:bg-muted/20">
                            <TableCell className="text-center font-mono text-muted-foreground font-medium">
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="flex size-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                                  <Icon name={proc.icon || "storefront"} className="size-4" aria-hidden="true" />
                                </span>
                                <span className="text-xs text-muted-foreground">{proc.icon}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold text-foreground text-xs">
                              {proc.title || <span className="text-muted-foreground italic">Belum ada judul</span>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground leading-relaxed">
                              {proc.description || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => setEditingProcessIndex(index)}
                                >
                                  Edit
                                </Button>
                                {form.data.production_processes.length > 1 ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => removeProductionProcess(index)}
                                  >
                                    Hapus
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableScroll>
              </div>

              {/* Tabel Cara Kerja / Alur Belanja */}
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3 sm:px-6">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Alur Cara Kerja & Pemesanan</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Urutan panduan belanja sederhana untuk pelanggan ({form.data.work_steps.length} dari maks 4 langkah).
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    disabled={form.data.work_steps.length >= 4}
                    onClick={addWorkStep}
                  >
                    <Icon name="plus" className="size-3.5 mr-1" aria-hidden="true" />
                    Tambah langkah
                  </Button>
                </div>

                <TableScroll>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20 text-[11px] font-semibold text-muted-foreground">
                        <TableHead className="w-12 text-center">No</TableHead>
                        <TableHead className="w-24">Nomor</TableHead>
                        <TableHead className="w-56">Judul Langkah</TableHead>
                        <TableHead>Penjelasan / Panduan</TableHead>
                        <TableHead className="w-32 text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.data.work_steps.map((step, index) => {
                        const isEditing = editingStepIndex === index

                        if (isEditing) {
                          return (
                            <TableRow key={index} className="bg-muted/10">
                              <TableCell colSpan={5} className="p-4 sm:p-6">
                                <div className="rounded-lg border border-primary/30 bg-card p-4 shadow-xs">
                                  <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3.5">
                                    <span className="text-xs font-bold text-foreground">
                                      Edit Langkah #{index + 1}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="xs"
                                      onClick={() => setEditingStepIndex(null)}
                                    >
                                      Selesai edit
                                    </Button>
                                  </div>
                                  <FieldGrid>
                                    <Field id={`edit_step_title_${index}`} label="Judul Langkah" required className="sm:col-span-2">
                                      <Input
                                        value={step.title}
                                        onChange={(e) => updateWorkStep(index, { title: e.target.value })}
                                        placeholder="mis. Pilih Produk Sesuai Kebutuhan"
                                        className="h-8 text-xs font-semibold"
                                      />
                                    </Field>
                                    <Field id={`edit_step_body_${index}`} label="Penjelasan" className="sm:col-span-2">
                                      <Textarea
                                        rows={2}
                                        value={step.body}
                                        onChange={(e) => updateWorkStep(index, { body: e.target.value })}
                                        placeholder="Pelanggan memilih varian ukuran atau langsung konsultasi..."
                                        className="text-xs"
                                      />
                                    </Field>
                                  </FieldGrid>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        }

                        return (
                          <TableRow key={index} className="hover:bg-muted/20">
                            <TableCell className="text-center font-mono text-muted-foreground font-medium">
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              <span className="font-bold tabular-nums text-primary">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                            </TableCell>
                            <TableCell className="font-semibold text-foreground text-xs">
                              {step.title || <span className="text-muted-foreground italic">Belum ada judul</span>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground leading-relaxed">
                              {step.body || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => setEditingStepIndex(index)}
                                >
                                  Edit
                                </Button>
                                {form.data.work_steps.length > 1 ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => removeWorkStep(index)}
                                  >
                                    Hapus
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableScroll>
              </div>
            </div>
          ) : null}

          {/* TAB 4: KONTAK, MAPS & MEDIA SOSIAL / MARKETPLACE */}
          {activeTab === "contact_social" ? (
            <div className="space-y-6">
              {/* Kontak Resmi & Lokasi Toko */}
              <SectionCard
                title="Kontak Resmi & Peta Google Maps"
                description="Informasi kontak, jam operasional, dan peta lokasi yang otomatis sinkron ke footer toko."
                icon="map-pin"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="contact_address"
                    label="Alamat Lengkap Toko / Workshop"
                    hint="Alamat fisik untuk kunjungan pelanggan dan pengiriman barang."
                    className="sm:col-span-2"
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

                  <Field
                    id="contact_phone"
                    label="Nomor Telepon / WhatsApp"
                    hint="Terisi otomatis dari nomor WhatsApp aktif yang tersambung di sistem."
                  >
                    <Input
                      value={form.data.contact.phone}
                      placeholder="Terisi otomatis dari nomor WhatsApp"
                      className="font-mono text-xs bg-muted text-muted-foreground"
                      readOnly
                    />
                  </Field>

                  <Field
                    id="contact_email"
                    label="Email Bisnis Resmi"
                    hint="Alamat email kontak resmi untuk penawaran dan pertanyaan proyek."
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
                    label="Jam Operasional Workshop"
                    hint="Hari dan jam kerja workshop (mis. Senin - Sabtu, 08.00 - 17.00 WIB)."
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
                    hint="Tautan untuk membuka rute langsung di aplikasi Google Maps."
                  >
                    <Input
                      type="url"
                      value={form.data.google_maps_url}
                      onChange={(e) => form.setData("google_maps_url", e.target.value)}
                      placeholder="https://maps.app.goo.gl/..."
                    />
                  </Field>

                  <Field
                    id="google_maps_embed_url"
                    label="URL Iframe Embed Google Maps"
                    error={form.errors.google_maps_embed_url}
                    hint="Tautan embed interaktif peta (ambil dari Google Maps > Share > Embed a map)."
                    className="sm:col-span-2"
                  >
                    <Input
                      value={form.data.google_maps_embed_url}
                      onChange={(e) => form.setData("google_maps_embed_url", e.target.value)}
                      placeholder="https://www.google.com/maps/embed?..."
                    />
                  </Field>

                  {form.data.google_maps_embed_url ? (
                    <div className="sm:col-span-2 overflow-hidden rounded-lg border border-border bg-muted/20">
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

              {/* Tautan Akun Media Sosial & Marketplace */}
              <div className="grid gap-6 md:grid-cols-2">
                <SectionCard
                  title="Akun Media Sosial Resmi"
                  description="Tautan profil media sosial resmi toko."
                  icon="share"
                >
                  <div className="space-y-3">
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

                <SectionCard
                  title="Toko Online & Marketplace"
                  description="Tautan toko resmi di berbagai platform e-commerce."
                  icon="storefront"
                >
                  <div className="space-y-3">
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
              </div>
            </div>
          ) : null}

          {/* Tombol Simpan & Batal Bawah */}
          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setMode("view")
                setEditingWhyIndex(null)
                setEditingProcessIndex(null)
                setEditingStepIndex(null)
              }}
            >
              Batal
            </Button>
            <Button type="submit" disabled={form.processing}>
              {form.processing ? "Menyimpan..." : "Simpan perubahan"}
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
