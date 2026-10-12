import { Head, Link, useForm } from "@inertiajs/react"
import DOMPurify from "dompurify"
import * as React from "react"

import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { CheckboxField, Field, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
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


  // Kontrak halaman pengaturan (ADR-023): halaman yang tugasnya mengubah nilai
  // yang sudah ada dibuka terkunci. Isian baru bisa diubah setelah admin
  // menekan Edit, supaya setelan tidak rawan tersunting tanpa sengaja saat
  // halaman cuma dibuka untuk melihat kondisi sekarang.
  const [mode, setMode] = React.useState<"view" | "edit">("view")
  const terkunci = mode === "view"

  function batal() {
    // Jangan router.reload(): Inertia di repo ini mempertahankan state sehingga
    // mode edit bertahan walau sudah dibatalkan.
    form.resetAndClearErrors()
    setMode("view")
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

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap gap-2">
          {mode === "view" ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setMode("edit")}
            >
              <Icon name="pencil" className="size-3.5" aria-hidden="true" />
              Edit
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={batal}>
                Batal
              </Button>
              <Button type="submit" form="cms-document-form" disabled={form.processing}>
                {form.processing ? "Menyimpan..." : saveLabel}
              </Button>
            </>
          )}
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
        id="cms-document-form"
        className="w-full max-w-5xl space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          form.put(submitUrl, {
            preserveScroll: true,
            onSuccess: () => {
              // Simpan berhasil = kondisi baru jadi acuan Batal berikutnya.
              form.setDefaults()
              setMode("view")
            },
          })
        }}
      >
        <FormErrorSummary errors={form.errors} />

        <SectionCard
          title="Meta Dokumen"
          description="Informasi dasar, judul, dan status publikasi halaman dokumen."
        >
          <FieldGrid>
            <Field id="doc-title" label="Judul CMS" required error={form.errors.title}>
              <Input disabled={terkunci} value={form.data.title} onChange={(event) => form.setData("title", event.target.value)} />
            </Field>
            <CheckboxField
              id="doc-published"
              disabled={terkunci}
              checked={form.data.published}
              onChange={(checked) => form.setData("published", checked)}
              label="Terbitkan halaman"
            />
            <Field id="doc-heading" label="Judul hero" required error={form.errors.heading} className="sm:col-span-2">
              <Input disabled={terkunci} value={form.data.heading} onChange={(event) => form.setData("heading", event.target.value)} />
            </Field>
            <p className="font-mono text-[11px] text-muted-foreground sm:col-span-2">Slug: {document.slug}</p>
          </FieldGrid>
        </SectionCard>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)] xl:items-start">
          <Field
            id="doc-body"
            label="Isi dokumen"
            hint="HTML atau teks biasa. Script/iframe tidak ditampilkan di publik."
            error={form.errors.body}
          >
            <Textarea
              disabled={terkunci}
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
        </div>
      </form>
    </AdminLayout>
  )
}
