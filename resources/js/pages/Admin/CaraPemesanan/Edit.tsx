import { Head, Link, useForm } from "@inertiajs/react"
import DOMPurify from "dompurify"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { humanize } from "@/lib/format"

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

  function updateCard(index: number, patch: Partial<InfoCard>) {
    form.setData(
      "info_cards",
      form.data.info_cards.map((card, i) => (i === index ? { ...card, ...patch } : card)),
    )
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <a href={previewUrl} target="_blank" rel="noreferrer">
              Lihat halaman publik
            </a>
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />
      <form
        className="mx-auto max-w-4xl space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          form.put(submitUrl)
        }}
      >
        <FormErrorSummary errors={form.errors} />

        <section className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
          <p className="text-xs font-bold tracking-tight text-muted-foreground">Meta halaman</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cp-title" label="Judul CMS" required error={form.errors.title}>
              <Input value={form.data.title} onChange={(event) => form.setData("title", event.target.value)} />
            </Field>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold sm:pt-7">
              <input
                type="checkbox"
                checked={form.data.published}
                onChange={(event) => form.setData("published", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Terbitkan halaman
            </label>
            <Field id="cp-heading" label="Judul hero" required error={form.errors.heading} className="sm:col-span-2">
              <Input value={form.data.heading} onChange={(event) => form.setData("heading", event.target.value)} />
            </Field>
            <Field id="cp-subtitle" label="Subjudul hero" error={form.errors.subtitle} className="sm:col-span-2">
              <Textarea
                rows={2}
                value={form.data.subtitle}
                onChange={(event) => form.setData("subtitle", event.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">Langkah pemesanan</p>
            <Button
              type="button"
              variant="secondary"
              disabled={form.data.steps.length >= 8}
              onClick={() =>
                form.setData("steps", [
                  ...form.data.steps,
                  { icon: "check", title: "", description: "", points: [] },
                ])
              }
            >
              Tambah langkah
            </Button>
          </div>
          {form.data.steps.map((step, index) => (
            <article key={index} className="rounded-lg border border-border bg-surface p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-bold">Langkah {index + 1}</p>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 px-2 text-xs text-destructive"
                  disabled={form.data.steps.length <= 1}
                  onClick={() =>
                    form.setData(
                      "steps",
                      form.data.steps.filter((_, i) => i !== index),
                    )
                  }
                >
                  Hapus
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id={`step-icon-${index}`} label="Ikon">
                  <Select value={step.icon} onChange={(event) => updateStep(index, { icon: event.target.value })}>
                    {iconOptions.map((icon) => (
                      <option key={icon} value={icon}>
                        {humanize(icon)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id={`step-title-${index}`} label="Judul">
                  <Input value={step.title} onChange={(event) => updateStep(index, { title: event.target.value })} />
                </Field>
                <Field id={`step-desc-${index}`} label="Deskripsi" className="sm:col-span-2">
                  <Textarea
                    rows={3}
                    value={step.description}
                    onChange={(event) => updateStep(index, { description: event.target.value })}
                  />
                </Field>
                <Field
                  id={`step-points-${index}`}
                  label="Poin checklist"
                  hint="Satu poin per baris"
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
            </article>
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">Kartu info</p>
            <Button
              type="button"
              variant="secondary"
              disabled={form.data.info_cards.length >= 6}
              onClick={() =>
                form.setData("info_cards", [
                  ...form.data.info_cards,
                  { icon: "check", title: "", description: "" },
                ])
              }
            >
              Tambah kartu
            </Button>
          </div>
          {form.data.info_cards.map((card, index) => (
            <article key={index} className="rounded-lg border border-border bg-surface p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-bold">Kartu {index + 1}</p>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 px-2 text-xs text-destructive"
                  onClick={() =>
                    form.setData(
                      "info_cards",
                      form.data.info_cards.filter((_, i) => i !== index),
                    )
                  }
                >
                  Hapus
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id={`card-icon-${index}`} label="Ikon">
                  <Select value={card.icon} onChange={(event) => updateCard(index, { icon: event.target.value })}>
                    {iconOptions.map((icon) => (
                      <option key={icon} value={icon}>
                        {humanize(icon)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id={`card-title-${index}`} label="Judul">
                  <Input value={card.title} onChange={(event) => updateCard(index, { title: event.target.value })} />
                </Field>
                <Field id={`card-desc-${index}`} label="Deskripsi" className="sm:col-span-2">
                  <Textarea
                    rows={3}
                    value={card.description}
                    onChange={(event) => updateCard(index, { description: event.target.value })}
                  />
                </Field>
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)]">
          <Field
            id="cp-body"
            label="Catatan tambahan (HTML/teks)"
            hint="Opsional. Ditampilkan di bawah langkah. Script/iframe tidak diizinkan."
            error={form.errors.body}
          >
            <Textarea
              rows={12}
              value={form.data.body}
              onChange={(event) => form.setData("body", event.target.value)}
              className="font-mono text-xs"
              placeholder="Tuliskan langkah-langkah pemesanan di sini..."
            />
          </Field>
          <aside>
            <p className="text-xs font-bold tracking-tight text-muted-foreground">Preview catatan</p>
            {bodyPreview ? (
              <article className="cms-content mt-3 text-sm" dangerouslySetInnerHTML={{ __html: bodyPreview }} />
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Kosong — tidak ada catatan tambahan.</p>
            )}
          </aside>
        </section>

        <div className="flex justify-end gap-2">
          <Button asChild variant="secondary">
            <Link href={previewUrl} target="_blank">
              Pratinjau
            </Link>
          </Button>
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
