import { Head, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"

type WhyPoint = { icon: string; title: string; body: string }
type WorkStep = { title: string; body: string }

type PageData = {
  hero_title: string
  hero_tagline: string
  why_points: WhyPoint[]
  work_steps: WorkStep[]
  trust_rows: string[]
}

export default function TentangKamiEdit({
  title,
  description,
  page,
  iconOptions,
  submitUrl,
  previewUrl,
}: {
  title: string
  description: string
  page: PageData
  iconOptions: string[]
  submitUrl: string
  previewUrl: string
}) {
  const form = useForm<{
    hero_title: string
    hero_tagline: string
    why_points: WhyPoint[]
    work_steps: WorkStep[]
    trust_rows: string
  }>({
    hero_title: page.hero_title ?? "",
    hero_tagline: page.hero_tagline ?? "",
    why_points: page.why_points.length
      ? page.why_points
      : [{ icon: "check-circle", title: "", body: "" }],
    work_steps: page.work_steps.length
      ? page.work_steps
      : [{ title: "", body: "" }],
    trust_rows: (page.trust_rows ?? []).join("\n"),
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.put(submitUrl)
  }

  function updateWhy(index: number, patch: Partial<WhyPoint>) {
    form.setData(
      "why_points",
      form.data.why_points.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    )
  }

  function updateStep(index: number, patch: Partial<WorkStep>) {
    form.setData(
      "work_steps",
      form.data.work_steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
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
          <Button type="submit" form="about-form" size="sm" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan perubahan"}
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <form id="about-form" onSubmit={submit} className="w-full space-y-6">
        <FormErrorSummary errors={form.errors} />

        {/* Bagian 1: Hero */}
        <Card className="space-y-4 p-5">
          <div className="border-b border-border pb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Judul Halaman
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tampil di bagian atas halaman Tentang Kami. Kosongkan untuk memakai teks baku.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="hero_title" label="Judul Utama" error={form.errors.hero_title}>
              <Input
                id="hero_title"
                value={form.data.hero_title}
                onChange={(e) => form.setData("hero_title", e.target.value)}
                placeholder="Tentang Kami"
                maxLength={120}
              />
            </Field>

            <Field id="hero_tagline" label="Kalimat Pengantar" error={form.errors.hero_tagline}>
              <Input
                id="hero_tagline"
                value={form.data.hero_tagline}
                onChange={(e) => form.setData("hero_tagline", e.target.value)}
                placeholder="Satu kalimat ringkas tentang toko Anda"
                maxLength={320}
              />
            </Field>
          </div>
        </Card>

        {/* Bagian 2: Kenapa memilih kami */}
        <Card className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Keunggulan Toko
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Kartu keunggulan dengan ikon (maksimal 6). Kosongkan semua untuk memakai teks baku.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              disabled={form.data.why_points.length >= 6}
              onClick={() =>
                form.setData("why_points", [
                  ...form.data.why_points,
                  { icon: "check-circle", title: "", body: "" },
                ])
              }
            >
              Tambah keunggulan
            </Button>
          </div>

          <div className="space-y-3">
            {form.data.why_points.map((point, index) => (
              <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[10rem_1fr_2fr_auto]">
                <Field id={`why-icon-${index}`} label={`Ikon ${index + 1}`}>
                  <Select
                    id={`why-icon-${index}`}
                    value={point.icon}
                    onChange={(e) => updateWhy(index, { icon: e.target.value })}
                  >
                    {iconOptions.map((icon) => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </Select>
                </Field>
                <Field id={`why-title-${index}`} label={`Judul ${index + 1}`} error={form.errors[`why_points.${index}.title`]}>
                  <Input
                    id={`why-title-${index}`}
                    value={point.title}
                    onChange={(e) => updateWhy(index, { title: e.target.value })}
                    placeholder="Contoh: Produksi sendiri"
                    maxLength={60}
                  />
                </Field>
                <Field id={`why-body-${index}`} label="Keterangan">
                  <Input
                    id={`why-body-${index}`}
                    value={point.body}
                    onChange={(e) => updateWhy(index, { body: e.target.value })}
                    placeholder="Kalimat penjelas singkat"
                    maxLength={200}
                  />
                </Field>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={form.data.why_points.length <= 1}
                    onClick={() =>
                      form.setData(
                        "why_points",
                        form.data.why_points.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Bagian 3: Cara kami bekerja */}
        <Card className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Langkah Kerja
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Alur pengerjaan dari konsultasi sampai pengiriman (maksimal 4). Nomor langkah terisi otomatis.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              disabled={form.data.work_steps.length >= 4}
              onClick={() =>
                form.setData("work_steps", [
                  ...form.data.work_steps,
                  { title: "", body: "" },
                ])
              }
            >
              Tambah langkah
            </Button>
          </div>

          <div className="space-y-3">
            {form.data.work_steps.map((step, index) => (
              <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_2fr_auto]">
                <Field id={`step-title-${index}`} label={`Langkah ${index + 1}`} error={form.errors[`work_steps.${index}.title`]}>
                  <Input
                    id={`step-title-${index}`}
                    value={step.title}
                    onChange={(e) => updateStep(index, { title: e.target.value })}
                    placeholder="Contoh: Konsultasi"
                    maxLength={60}
                  />
                </Field>
                <Field id={`step-body-${index}`} label="Keterangan">
                  <Input
                    id={`step-body-${index}`}
                    value={step.body}
                    onChange={(e) => updateStep(index, { body: e.target.value })}
                    placeholder="Penjelasan singkat langkah ini"
                    maxLength={200}
                  />
                </Field>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={form.data.work_steps.length <= 1}
                    onClick={() =>
                      form.setData(
                        "work_steps",
                        form.data.work_steps.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Bagian 4: Baris kepercayaan */}
        <Card className="space-y-4 p-5">
          <div className="border-b border-border pb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Daftar Jaminan Toko
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Satu jaminan per baris (maksimal 6 baris). Tampil sebagai daftar centang di halaman Tentang Kami.
            </p>
          </div>

          <Field id="trust_rows" label="Daftar Jaminan (satu per baris)">
            <Textarea
              id="trust_rows"
              rows={5}
              value={form.data.trust_rows}
              onChange={(e) => form.setData("trust_rows", e.target.value)}
              placeholder={"Melayani pengiriman ke seluruh Indonesia\nBisa konsultasi sebelum pesan"}
            />
          </Field>
        </Card>
      </form>
    </AdminLayout>
  )
}
