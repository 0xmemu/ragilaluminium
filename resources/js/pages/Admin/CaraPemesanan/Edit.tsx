import { Head, useForm } from "@inertiajs/react"
import DOMPurify from "dompurify"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { CheckboxField, Field, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { SubmitGateButton } from "@/components/admin/ui/submit-gate-button"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { humanize } from "@/lib/format"
import { gerbangBolehLanjut } from "@/lib/submit-gate"

interface StepItem {
  icon: string
  title: string
  description: string
  points: string[]
}

interface InfoCard {
  icon: string
  title: string
  description: string
}

interface PageData {
  title: string
  published: boolean
  heading: string
  subtitle: string
  body: string
  steps: StepItem[]
  info_cards: InfoCard[]
}

function pointsToText(points: string[]): string {
  return points.join("\n")
}

function textToPoints(value: string): string[] {
  return value
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export default function CaraPemesananEdit({
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
  const [showMeta, setShowMeta] = React.useState(false)
  const [editingStepIndex, setEditingStepIndex] = React.useState<number | null>(null)
  const [editingCardIndex, setEditingCardIndex] = React.useState<number | null>(null)

  const form = useForm({
    title: page.title,
    published: page.published,
    heading: page.heading,
    subtitle: page.subtitle,
    body: page.body,
    steps: page.steps.length
      ? page.steps
      : [{ icon: "search", title: "", description: "", points: [] as string[] }],
    info_cards: page.info_cards,
  })

  const bodyPreview = React.useMemo(
    () =>
      DOMPurify.sanitize(form.data.body, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
        FORBID_ATTR: ["style", "onerror", "onclick"],
      }),
    [form.data.body],
  )

  function updateStep(index: number, patch: Partial<StepItem>) {
    form.setData(
      "steps",
      form.data.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    )
  }

  function addStep() {
    if (form.data.steps.length >= 8) return
    const newSteps = [
      ...form.data.steps,
      { icon: "check", title: "", description: "", points: [] },
    ]
    form.setData("steps", newSteps)
    setEditingStepIndex(newSteps.length - 1)
  }

  function removeStep(index: number) {
    if (form.data.steps.length <= 1) return
    form.setData(
      "steps",
      form.data.steps.filter((_, i) => i !== index),
    )
    if (editingStepIndex === index) setEditingStepIndex(null)
  }

  function updateCard(index: number, patch: Partial<InfoCard>) {
    form.setData(
      "info_cards",
      form.data.info_cards.map((card, i) => (i === index ? { ...card, ...patch } : card)),
    )
  }

  function addCard() {
    if (form.data.info_cards.length >= 6) return
    const newCards = [
      ...form.data.info_cards,
      { icon: "check", title: "", description: "" },
    ]
    form.setData("info_cards", newCards)
    setEditingCardIndex(newCards.length - 1)
  }

  function removeCard(index: number) {
    form.setData(
      "info_cards",
      form.data.info_cards.filter((_, i) => i !== index),
    )
    if (editingCardIndex === index) setEditingCardIndex(null)
  }

  const gerbang = {
    fields: { title: "Judul CMS", heading: "Judul hero" },
    requireChange: true,
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary">
            <a href={previewUrl} target="_blank" rel="noreferrer">
              Lihat halaman publik
            </a>
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowMeta((prev) => !prev)}
          >
            {showMeta ? "Tutup pengaturan" : "Pengaturan halaman"}
          </Button>
          <SubmitGateButton
            form={form}
            {...gerbang}
            formId="cara-pemesanan-form"
            size="sm"
          >
            Simpan perubahan
          </SubmitGateButton>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <form
        id="cara-pemesanan-form"
        className="w-full space-y-6"
        onSubmit={(event) => {
          if (!gerbangBolehLanjut(event, form, gerbang)) return
          event.preventDefault()
          form.put(submitUrl, {
            preserveScroll: true,
            onSuccess: () => {
              form.setDefaults()
              setEditingStepIndex(null)
              setEditingCardIndex(null)
            },
          })
        }}
      >
        <FormErrorSummary errors={form.errors} />

        {/* Panel Pengaturan Halaman (Collapsible ala /admin/faq) */}
        {showMeta ? (
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-tight text-muted-foreground">Pengaturan hero & metadata</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Judul hero utama di storefront publik dan status publikasi halaman.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => setShowMeta(false)}
              >
                Tutup
              </Button>
            </div>

            <div className="mt-4">
              <FieldGrid>
                <Field id="cmspage-title" label="Judul CMS" required error={form.errors.title}>
                  <Input value={form.data.title} onChange={(event) => form.setData("title", event.target.value)} />
                </Field>
                <CheckboxField
                  id="cmspage-published"
                  checked={form.data.published}
                  onChange={(checked) => form.setData("published", checked)}
                  label="Terbitkan halaman"
                />
                <Field id="cmspage-heading" label="Judul hero" required error={form.errors.heading} className="sm:col-span-2">
                  <Input value={form.data.heading} onChange={(event) => form.setData("heading", event.target.value)} />
                </Field>
                <Field id="cmspage-subtitle" label="Subjudul hero" error={form.errors.subtitle} className="sm:col-span-2">
                  <Textarea
                    rows={2}
                    value={form.data.subtitle}
                    onChange={(event) => form.setData("subtitle", event.target.value)}
                  />
                </Field>
              </FieldGrid>
            </div>
          </section>
        ) : null}

        {/* =====================================================================
            TABEL 1: LANGKAH PEMESANAN (TABLE-FIRST DENGAN INLINE EDIT)
            ===================================================================== */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Langkah Pemesanan</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Alur tahapan belanja pembeli dari pemilihan produk hingga pesanan sampai ({form.data.steps.length} dari maks 8 langkah).
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              disabled={form.data.steps.length >= 8}
              onClick={addStep}
            >
              <Icon name="plus" className="size-3.5 mr-1" aria-hidden="true" />
              Tambah langkah
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-left text-[11px] font-semibold text-muted-foreground">
                  <th className="w-12 px-4 py-3 text-center">No</th>
                  <th className="w-40 px-4 py-3">Ikon</th>
                  <th className="px-4 py-3">Langkah & Deskripsi</th>
                  <th className="w-64 px-4 py-3">Poin Checklist</th>
                  <th className="w-32 px-4 py-3 text-right sm:pr-6">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {form.data.steps.map((step, index) => {
                  const isEditing = editingStepIndex === index

                  if (isEditing) {
                    return (
                      <tr key={index} className="bg-muted/10">
                        <td colSpan={5} className="p-4 sm:p-6">
                          <div className="rounded-lg border border-primary/30 bg-card p-4 shadow-xs">
                            <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3.5">
                              <span className="text-xs font-bold text-foreground">
                                Edit Langkah {index + 1}
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
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field id={`step-icon-${index}`} label="Ikon">
                                <Select
                                  value={step.icon}
                                  onChange={(event) => updateStep(index, { icon: event.target.value })}
                                >
                                  {iconOptions.map((icon) => (
                                    <option key={icon} value={icon}>
                                      {humanize(icon)}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                              <Field id={`step-title-${index}`} label="Judul langkah" required>
                                <Input
                                  value={step.title}
                                  onChange={(event) => updateStep(index, { title: event.target.value })}
                                  placeholder="Contoh: Pilih model & produk"
                                />
                              </Field>
                              <Field id={`step-desc-${index}`} label="Deskripsi ringkas" className="sm:col-span-2">
                                <Textarea
                                  rows={2}
                                  value={step.description}
                                  onChange={(event) => updateStep(index, { description: event.target.value })}
                                  placeholder="Penjelasan tahapan belanja..."
                                />
                              </Field>
                              <Field
                                id={`step-points-${index}`}
                                label="Poin checklist"
                                hint="Tulis satu poin per baris"
                                className="sm:col-span-2"
                              >
                                <Textarea
                                  rows={3}
                                  value={pointsToText(step.points)}
                                  onChange={(event) => updateStep(index, { points: textToPoints(event.target.value) })}
                                  placeholder={"Filter berdasarkan kategori\nLihat detail produk"}
                                />
                              </Field>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={index} className="transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 text-center align-top font-mono text-muted-foreground font-medium">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-primary">
                            <Icon name={step.icon} className="size-4" aria-hidden="true" />
                          </span>
                          <span className="font-medium text-foreground capitalize">{humanize(step.icon)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="font-semibold text-foreground text-xs">{step.title || <span className="text-muted-foreground italic">Belum ada judul</span>}</p>
                        {step.description ? (
                          <p className="mt-1 text-muted-foreground leading-relaxed line-clamp-2">{step.description}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {step.points.length > 0 ? (
                          <ul className="space-y-1">
                            {step.points.map((pt, pIdx) => (
                              <li key={pIdx} className="flex items-start gap-1.5 text-muted-foreground text-[11px]">
                                <Icon name="check" className="size-3 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                                <span className="line-clamp-1">{pt}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground/60 italic text-[11px]">Tidak ada poin checklist</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right sm:pr-6 align-top">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={() => setEditingStepIndex(index)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            className="text-destructive hover:text-destructive"
                            disabled={form.data.steps.length <= 1}
                            onClick={() => removeStep(index)}
                          >
                            Hapus
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* =====================================================================
            TABEL 2: KARTU INFORMASI (TABLE-FIRST DENGAN INLINE EDIT)
            ===================================================================== */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Kartu Informasi Tambahan</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Kartu pendukung pembayaran, pengiriman, dan bantuan layanan ({form.data.info_cards.length} dari maks 6 kartu).
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              disabled={form.data.info_cards.length >= 6}
              onClick={addCard}
            >
              <Icon name="plus" className="size-3.5 mr-1" aria-hidden="true" />
              Tambah kartu
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-left text-[11px] font-semibold text-muted-foreground">
                  <th className="w-12 px-4 py-3 text-center">No</th>
                  <th className="w-40 px-4 py-3">Ikon</th>
                  <th className="w-48 px-4 py-3">Judul</th>
                  <th className="px-4 py-3">Deskripsi Informasi</th>
                  <th className="w-32 px-4 py-3 text-right sm:pr-6">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {form.data.info_cards.map((card, index) => {
                  const isEditing = editingCardIndex === index

                  if (isEditing) {
                    return (
                      <tr key={index} className="bg-muted/10">
                        <td colSpan={5} className="p-4 sm:p-6">
                          <div className="rounded-lg border border-primary/30 bg-card p-4 shadow-xs">
                            <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3.5">
                              <span className="text-xs font-bold text-foreground">
                                Edit Kartu {index + 1}
                              </span>
                              <Button
                                type="button"
                                variant="secondary"
                                size="xs"
                                onClick={() => setEditingCardIndex(null)}
                              >
                                Selesai edit
                              </Button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field id={`card-icon-${index}`} label="Ikon">
                                <Select
                                  value={card.icon}
                                  onChange={(event) => updateCard(index, { icon: event.target.value })}
                                >
                                  {iconOptions.map((icon) => (
                                    <option key={icon} value={icon}>
                                      {humanize(icon)}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                              <Field id={`card-title-${index}`} label="Judul kartu" required>
                                <Input
                                  value={card.title}
                                  onChange={(event) => updateCard(index, { title: event.target.value })}
                                  placeholder="Contoh: Metode pembayaran"
                                />
                              </Field>
                              <Field id={`card-desc-${index}`} label="Deskripsi informasi" className="sm:col-span-2">
                                <Textarea
                                  rows={2}
                                  value={card.description}
                                  onChange={(event) => updateCard(index, { description: event.target.value })}
                                  placeholder="Penjelasan kartu..."
                                />
                              </Field>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={index} className="transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 text-center align-top font-mono text-muted-foreground font-medium">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-primary">
                            <Icon name={card.icon} className="size-4" aria-hidden="true" />
                          </span>
                          <span className="font-medium text-foreground capitalize">{humanize(card.icon)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top font-semibold text-foreground">
                        {card.title || <span className="text-muted-foreground italic">Belum ada judul</span>}
                      </td>
                      <td className="px-4 py-3 align-top text-muted-foreground leading-relaxed">
                        {card.description || "-"}
                      </td>
                      <td className="px-4 py-3 text-right sm:pr-6 align-top">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={() => setEditingCardIndex(index)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeCard(index)}
                          >
                            Hapus
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* =====================================================================
            SEKSI 3: CATATAN TAMBAHAN (OPSIONAL)
            ===================================================================== */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/40 px-4 py-3 sm:px-6">
            <h2 className="text-sm font-semibold text-foreground">Catatan Tambahan (Opsional)</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Catatan khusus seperti panduan ukuran custom yang ditampilkan di bagian bawah alur pemesanan. Kosongkan jika ingin memakai catatan bawaan.
            </p>
          </div>

          <div className="p-4 sm:p-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
            <Field
              id="cp-body"
              label="Teks catatan tambahan"
              hint="Format paragraf atau HTML sederhana diperbolehkan."
              error={form.errors.body}
            >
              <Textarea
                rows={5}
                value={form.data.body}
                onChange={(event) => form.setData("body", event.target.value)}
                placeholder="Contoh: Kami melayani ukuran custom. Sertakan model dan ukuran (Tinggi × Panjang, cm) saat chat admin..."
                className="text-xs"
              />
            </Field>

            <aside className="rounded-lg border border-border bg-muted/20 p-3.5">
              <p className="text-[11px] font-bold tracking-tight text-muted-foreground">
                Pratinjau Catatan
              </p>
              {bodyPreview ? (
                <article className="cms-content mt-2 text-xs leading-relaxed text-foreground" dangerouslySetInnerHTML={{ __html: bodyPreview }} />
              ) : (
                <div className="mt-2 text-xs text-muted-foreground italic">
                  Catatan kustom kosong. Halaman publik akan menampilkan catatan default ukuran custom secara otomatis.
                </div>
              )}
            </aside>
          </div>
        </div>

      </form>
    </AdminLayout>
  )
}
