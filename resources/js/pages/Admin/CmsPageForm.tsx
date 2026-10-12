import { Head, Link, useForm } from "@inertiajs/react"
import DOMPurify from "dompurify"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { CheckboxField, Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import { SubmitGateButton } from "@/components/admin/ui/submit-gate-button"
import { gerbangBolehLanjut } from "@/lib/submit-gate"

interface CmsPageRecord {
  id: number
  slug: string
  title: string
  content?: { html?: string; body?: string } | null
  published: boolean
}

export default function CmsPageForm({
  page,
  submitUrl,
  backUrl,
}: {
  page: CmsPageRecord | null
  submitUrl: string
  backUrl?: string | null
}) {
  const editing = Boolean(page)
  const form = useForm({
    slug: page?.slug ?? "",
    title: page?.title ?? "",
    content: {
      html: page?.content?.html ?? page?.content?.body ?? "",
    },
    published: page?.published ?? false,
  })
  // Kontrak halaman pengaturan (ADR-023): nilai yang sudah ada dibuka terkunci.
  // Halaman baru dikecualikan karena diisi dari nol, jadi kuncinya hanya
  // berlaku saat menyunting halaman yang sudah ada.
  const [mode, setMode] = React.useState<"view" | "edit">("view")
  const terkunci = editing && mode === "view"

  function batal() {
    // Jangan router.reload(): Inertia di repo ini mempertahankan state sehingga
    // mode edit bertahan walau sudah dibatalkan.
    form.resetAndClearErrors()
    setMode("view")
  }

  const preview = React.useMemo(
    () =>
      DOMPurify.sanitize(form.data.content.html, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
        FORBID_ATTR: ["style", "onerror", "onclick"],
      }),
    [form.data.content.html],
  )


  // Gerbang isi tombol simpan: kolom wajibnya mengikuti aturan
  // `required` controller, jadi frontend tidak menciptakan aturan baru.
  const gerbang = {
    fields: {"slug": "Slug", "title": "Judul"},
    requireChange: editing,
  }

  return (
    <AdminLayout
      backUrl={backUrl}
      title={editing ? "Edit halaman CMS" : "Tambah halaman CMS"}
      description={editing ? page?.slug : "Konten publik disimpan sebagai HTML terstruktur."}
      actions={
        <div className="flex flex-wrap gap-2">
          {editing && mode === "edit" ? (
            <Button type="button" variant="secondary" size="sm" onClick={batal}>
              Batal
            </Button>
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link href={routeUrl("admin.pages.index")}>Batal</Link>
            </Button>
          )}
          {editing && mode === "view" ? (
            <Button type="button" size="sm" onClick={() => setMode("edit")}>
              <Icon name="pencil" className="size-3.5" aria-hidden="true" />
              Edit
            </Button>
          ) : (
                        <SubmitGateButton
              form={form}
              {...gerbang}
              formId="cms-page-form"
              size="sm"
            >
              Simpan halaman
            </SubmitGateButton>
          )}
        </div>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Halaman CMS | Admin`} />

      <form
        id="cms-page-form"
        onSubmit={(event) => {
          if (!gerbangBolehLanjut(event, form, gerbang)) return
          event.preventDefault()
          if (editing) {
            form.put(submitUrl, {
              preserveScroll: true,
              onSuccess: () => {
                // Simpan berhasil = kondisi baru jadi acuan Batal berikutnya.
                form.setDefaults()
                setMode("view")
              },
            })
          } else {
            form.post(submitUrl)
          }
        }}
        className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)] xl:items-start"
      >
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <FormErrorSummary errors={form.errors} />
          <div className="mt-1 grid gap-4 sm:grid-cols-2">
            <Field id="cms-title" label="Judul" required error={form.errors.title}>
              <Input disabled={terkunci} value={form.data.title} onChange={(event) => form.setData("title", event.target.value)} />
            </Field>
            <Field
              id="cms-slug"
              label="Slug"
              required
              error={form.errors.slug}
              hint={editing ? "Slug tidak diubah pada mode edit." : "Gunakan lowercase-kebab-case."}
            >
              <Input
                value={form.data.slug}
                onChange={(event) => form.setData("slug", event.target.value)}
                disabled={editing}
                className="font-mono"
              />
            </Field>
            <Field
              id="cms-content"
              label="Konten HTML"
              error={form.errors.content}
              hint="Gunakan heading, paragraf, daftar, link, dan blockquote. Script dan iframe tidak ditampilkan."
              className="sm:col-span-2"
            >
              <Textarea
                disabled={terkunci}
                rows={18}
                value={form.data.content.html}
                onChange={(event) => form.setData("content", { html: event.target.value })}
                className="font-mono text-xs"
              />
            </Field>
            <CheckboxField
              id="cms-published"
              disabled={terkunci}
              checked={form.data.published}
              onChange={(checked) => form.setData("published", checked)}
              label="Terbitkan halaman"
              standalone
              className="sm:col-span-2"
            />
          </div>
        </section>

        <aside className="rounded-lg border border-border bg-card p-5 shadow-sm xl:sticky xl:top-24">
          <p className="text-xs font-bold tracking-tight text-muted-foreground">
            Preview aman
          </p>
          {preview ? (
            <article
              className="cms-content mt-4 text-sm"
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Mulai menulis untuk melihat preview.</p>
          )}
        </aside>
      </form>
    </AdminLayout>
  )
}
