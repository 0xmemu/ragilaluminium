import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import AdminLayout from "@/layouts/admin-layout"

interface AnnouncementFormData {
  id?: number
  text: string
  href?: string | null
  starts_at?: string | null
  ends_at?: string | null
  sort_order: number
  published: boolean
}

export default function AnnouncementForm({
  announcement,
  submitUrl,
  method,
  indexHref,
}: {
  announcement: AnnouncementFormData | null
  submitUrl: string
  method: "post" | "put"
  indexHref: string
}) {
  const isEdit = Boolean(announcement?.id)
  const form = useForm<{
    text: string
    href: string
    starts_at: string
    ends_at: string
    sort_order: number
    published: boolean
  }>({
    text: announcement?.text ?? "",
    href: announcement?.href ?? "",
    starts_at: announcement?.starts_at ?? "",
    ends_at: announcement?.ends_at ?? "",
    sort_order: announcement?.sort_order ?? 0,
    published: announcement?.published ?? true,
  })

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (method === "put") {
      form.transform((data) => ({ ...data, _method: "put" }))
      form.post(submitUrl, {
        preserveScroll: true,
        onFinish: () => form.transform((data) => data),
      })
      return
    }
    form.post(submitUrl, { preserveScroll: true })
  }

  return (
    <AdminLayout
      title={isEdit ? "Edit Bar Promo" : "Tambah Bar Promo"}
      description="Teks promo pada bar merah di atas header storefront (homepage)."
      actions={
        <Button asChild variant="secondary">
          <Link href={indexHref}>
            <Icon name="arrow-left" className="size-4" aria-hidden="true" />
            Kembali
          </Link>
        </Button>
      }
    >
      <Head title={`${isEdit ? "Edit" : "Tambah"} Bar Promo | Admin`} />

      <form onSubmit={onSubmit} className="mx-auto grid max-w-3xl gap-6">
        <FormErrorSummary errors={form.errors} />

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <Field
              id="text"
              label="Teks promo"
              error={form.errors.text}
              hint="Maksimal 64 karakter agar tetap ringkas di mobile."
            >
              <Input
                value={form.data.text}
                onChange={(event) => form.setData("text", event.target.value)}
                placeholder="Mis. Diskon sampai 30% untuk semua model"
                maxLength={64}
              />
            </Field>
            <Field
              id="href"
              label="Link tujuan / produk terkait"
              error={form.errors.href}
              hint="Path internal (mis. /products/bouven/jungkit) atau URL penuh. Kosongkan untuk arahkan ke katalog."
            >
              <Input
                value={form.data.href}
                onChange={(event) => form.setData("href", event.target.value)}
                placeholder="/products/bouven/jungkit"
              />
            </Field>
            <Field id="starts" label="Mulai (opsional)" error={form.errors.starts_at}>
              <Input
                type="date"
                value={form.data.starts_at}
                onChange={(event) => form.setData("starts_at", event.target.value)}
              />
            </Field>
            <Field id="ends" label="Berakhir (opsional)" error={form.errors.ends_at}>
              <Input
                type="date"
                value={form.data.ends_at}
                onChange={(event) => form.setData("ends_at", event.target.value)}
              />
            </Field>
            <Field id="sort" label="Urutan tampil" error={form.errors.sort_order} className="sm:max-w-40">
              <Input
                type="number"
                min={0}
                max={9999}
                value={form.data.sort_order}
                onChange={(event) => form.setData("sort_order", Number(event.target.value))}
              />
            </Field>
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-medium sm:self-end">
              <input
                type="checkbox"
                checked={form.data.published}
                onChange={(event) => form.setData("published", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Status aktif (published)
            </label>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : isEdit ? "Simpan perubahan" : "Tambah bar promo"}
          </Button>
          <Button asChild type="button" variant="secondary">
            <Link href={indexHref}>Batal</Link>
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
