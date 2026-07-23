import { Head, Link, useForm } from "@inertiajs/react"
import DOMPurify from "dompurify"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"

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
}: {
  page: CmsPageRecord | null
  submitUrl: string
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
  const preview = React.useMemo(
    () =>
      DOMPurify.sanitize(form.data.content.html, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
        FORBID_ATTR: ["style", "onerror", "onclick"],
      }),
    [form.data.content.html],
  )

  return (
    <AdminLayout
      title={editing ? "Edit halaman CMS" : "Tambah halaman CMS"}
      description={editing ? page?.slug : "Konten publik disimpan sebagai HTML terstruktur."}
      actions={
        <Button asChild variant="secondary">
          <Link href={routeUrl("admin.pages.index")}>Batal</Link>
        </Button>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Halaman CMS | Admin`} />

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (editing) form.put(submitUrl)
          else form.post(submitUrl)
        }}
        className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)] xl:items-start"
      >
        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
          <FormErrorSummary errors={form.errors} />
          <div className="mt-1 grid gap-5 sm:grid-cols-2">
            <Field id="cms-title" label="Judul" required error={form.errors.title}>
              <Input value={form.data.title} onChange={(event) => form.setData("title", event.target.value)} />
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
                rows={18}
                value={form.data.content.html}
                onChange={(event) => form.setData("content", { html: event.target.value })}
                className="font-mono text-xs"
              />
            </Field>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold sm:col-span-2">
              <input
                type="checkbox"
                checked={form.data.published}
                onChange={(event) => form.setData("published", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Terbitkan halaman
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-5">
            <Button asChild variant="secondary">
              <Link href={routeUrl("admin.pages.index")}>Batal</Link>
            </Button>
            <Button type="submit" disabled={form.processing}>
              {form.processing ? "Menyimpan..." : "Simpan halaman"}
            </Button>
          </div>
        </section>

        <aside className="rounded-lg border border-border bg-surface p-5 shadow-sm xl:sticky xl:top-24">
          <p className="text-xs font-bold tracking-tight text-muted-foreground">
            Preview aman
          </p>
          {preview ? (
            <article
              className="cms-content mt-5 text-sm"
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">Mulai menulis untuk melihat preview.</p>
          )}
        </aside>
      </form>
    </AdminLayout>
  )
}
