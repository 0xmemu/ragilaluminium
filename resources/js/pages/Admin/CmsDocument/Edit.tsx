import { Head, Link, useForm } from "@inertiajs/react"
import DOMPurify from "dompurify"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"

interface DocumentData {
  title: string
  heading: string
  body: string
  published: boolean
  slug: string
}

export default function CmsDocumentEdit({
  title,
  description,
  document,
  submitUrl,
  previewUrl,
  hubUrl,
  saveLabel = "Simpan Pembaruan Dokumen",
}: {
  title: string
  description: string
  document: DocumentData
  submitUrl: string
  previewUrl: string
  hubUrl: string
  saveLabel?: string
}) {
  const form = useForm({
    title: document.title,
    heading: document.heading,
    body: document.body,
    published: document.published,
  })

  const preview = React.useMemo(
    () =>
      DOMPurify.sanitize(form.data.body, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
        FORBID_ATTR: ["style", "onerror", "onclick"],
      }),
    [form.data.body],
  )

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
          <Button asChild variant="secondary">
            <Link href={hubUrl}>Kembali ke Hub</Link>
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          form.put(submitUrl)
        }}
      >
        <FormErrorSummary errors={form.errors} />

        <section className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6 sm:grid-cols-2">
          <Field id="doc-title" label="Judul CMS" required error={form.errors.title}>
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
          <Field id="doc-heading" label="Judul hero" required error={form.errors.heading} className="sm:col-span-2">
            <Input value={form.data.heading} onChange={(event) => form.setData("heading", event.target.value)} />
          </Field>
          <p className="font-mono text-[11px] text-muted-foreground sm:col-span-2">Slug: {document.slug}</p>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)] xl:items-start">
          <Field
            id="doc-body"
            label="Isi dokumen"
            hint="HTML atau teks biasa. Script/iframe tidak ditampilkan di publik."
            error={form.errors.body}
          >
            <Textarea
              rows={22}
              value={form.data.body}
              onChange={(event) => form.setData("body", event.target.value)}
              className="min-h-[28rem] font-mono text-xs"
              placeholder="Tuliskan isi dokumen di sini..."
            />
          </Field>
          <aside className="rounded-xl border border-border bg-card p-5 shadow-sm xl:sticky xl:top-24">
            <p className="text-xs font-bold tracking-tight text-muted-foreground">Preview aman</p>
            {preview ? (
              <article className="cms-content mt-4 text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Mulai menulis untuk melihat preview.</p>
            )}
          </aside>
        </section>

        <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:mx-0 sm:rounded-lg sm:border sm:px-5">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button asChild variant="secondary">
              <Link href={hubUrl}>Kembali ke Hub</Link>
            </Button>
            <Button type="submit" disabled={form.processing}>
              {form.processing ? "Menyimpan..." : saveLabel}
            </Button>
          </div>
        </div>
      </form>
    </AdminLayout>
  )
}
