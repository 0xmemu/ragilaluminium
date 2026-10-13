import { Head, Link, useForm } from "@inertiajs/react"
import DOMPurify from "dompurify"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { CheckboxField, Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { SubmitGateButton } from "@/components/admin/ui/submit-gate-button"
import { gerbangBolehLanjut } from "@/lib/submit-gate"

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
  saveLabel = "Simpan Dokumen",
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



  function batal() {
    form.resetAndClearErrors()
  }

  const preview = React.useMemo(
    () =>
      DOMPurify.sanitize(form.data.body, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
        FORBID_ATTR: ["style", "onerror", "onclick"],
      }),
    [form.data.body],
  )

  // Gerbang isi tombol simpan: kolom wajibnya mengikuti aturan
  // `required` controller, jadi frontend tidak menciptakan aturan baru.
  const gerbang = {
    fields: { title: "Judul CMS", heading: "Judul hero" },
    requireChange: true,
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      backUrl={hubUrl}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5">
              <Icon name="arrow-up-right" className="size-3.5" aria-hidden="true" />
              <span>Lihat di toko</span>
            </a>
          </Button>

          {form.isDirty ? (
            <Button type="button" variant="secondary" size="sm" onClick={batal}>
              Batal
            </Button>
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link href={hubUrl}>Kembali</Link>
            </Button>
          )}

          <SubmitGateButton
            form={form}
            {...gerbang}
            formId="cms-document-form"
            size="sm"
          >
            {saveLabel}
          </SubmitGateButton>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <form
        id="cms-document-form"
        className="w-full space-y-6"
        onSubmit={(event) => {
          if (!gerbangBolehLanjut(event, form, gerbang)) return
          event.preventDefault()
          form.put(submitUrl, {
            preserveScroll: true,
            onSuccess: () => {
              // Simpan berhasil = kondisi baru jadi acuan Batal berikutnya.
              form.setDefaults()
            },
          })
        }}
      >
        <FormErrorSummary errors={form.errors} />

        {/* 1. Meta Dokumen (Table-First) */}
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Pengaturan Dokumen</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Judul halaman, tajuk pembuka, dan status penayangan dokumen di publik.
            </p>
          </div>
          <table className="w-full">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="w-64 px-4 py-3 text-left align-top text-xs font-semibold text-foreground">
                  Judul CMS <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-3">
                  <Input
                    value={form.data.title}
                    onChange={(event) => form.setData("title", event.target.value)}
                    className="max-w-md"
                  />
                  {form.errors.title ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.title}</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Judul dokumen yang tampil pada tab peramban dan navigasi.
                    </p>
                  )}
                </td>
              </tr>

              <tr>
                <th className="w-64 px-4 py-3 text-left align-top text-xs font-semibold text-foreground">
                  Judul Hero <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-3">
                  <Input
                    value={form.data.heading}
                    onChange={(event) => form.setData("heading", event.target.value)}
                    className="max-w-xl"
                  />
                  {form.errors.heading ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.heading}</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tajuk besar yang tampil di bagian atas halaman publik.
                    </p>
                  )}
                </td>
              </tr>

              <tr>
                <th className="w-64 px-4 py-3 text-left align-top text-xs font-semibold text-foreground">
                  Status Publikasi
                </th>
                <td className="px-4 py-3">
                  <CheckboxField
                    id="doc-published"
                    checked={form.data.published}
                    onChange={(checked) => form.setData("published", checked)}
                    label={
                      <span className="font-semibold text-foreground text-xs">
                        Terbitkan dokumen di website
                      </span>
                    }
                    standalone
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Slug publik: <span className="font-mono font-medium text-foreground">/{document.slug}</span>
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2. Isi Dokumen & Pratinjau Bersih */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:items-start">
          <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
            <Field
              id="doc-body"
              label="Isi Dokumen"
              hint="Format HTML atau teks terstruktur. Tag berbahaya seperti script dan iframe disaring otomatis."
              error={form.errors.body}
            >
              <Textarea
                rows={24}
                value={form.data.body}
                onChange={(event) => form.setData("body", event.target.value)}
                className="min-h-[30rem] font-mono text-xs leading-relaxed"
                placeholder="Tuliskan isi dokumen di sini..."
              />
            </Field>
          </div>

          <aside className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-xs xl:sticky xl:top-24">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <p className="text-xs font-bold text-foreground">Pratinjau Tampilan Publik</p>
              <span className="text-[11px] font-mono text-muted-foreground">/{document.slug}</span>
            </div>
            {preview ? (
              <article
                className="cms-content mt-4 max-h-[70vh] overflow-y-auto text-sm leading-relaxed pr-1"
                dangerouslySetInnerHTML={{ __html: preview }}
              />
            ) : (
              <p className="mt-4 text-xs text-muted-foreground italic">
                Belum ada konten untuk ditampilkan di pratinjau.
              </p>
            )}
          </aside>
        </div>
      </form>
    </AdminLayout>
  )
}
