import { Head, Link, useForm } from "@inertiajs/react"

import { Button } from "@/components/admin/ui/button"
import { Field } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { Icon } from "@/components/shared/icon"

interface Props {
  title: string
  description: string
  backUrl: string
  category: {
    id: number
    code: string
    name: string
    slug: string
    seo_title?: string | null
    seo_description?: string | null
    sort_order: number
    is_active: boolean
  } | null
  submitUrl: string
}

export default function CategoryForm({ title, description, category, submitUrl, backUrl }: Props) {
  const form = useForm({
    code: category?.code ?? "",
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    seo_title: category?.seo_title ?? "",
    seo_description: category?.seo_description ?? "",
    sort_order: category?.sort_order ?? 0,
    is_active: category?.is_active ?? true,
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.isDirty) form[category ? "put" : "post"](submitUrl)
  }

  return (
    <AdminLayout title={title} description={description} backUrl={backUrl}>
      <Head title={`${title} | Admin`} />
      <div className="mb-4">
        <Button asChild variant="secondary">
          <Link href={route("admin.categories.index")}>
            <Icon name="arrow-left" className="size-4" aria-hidden="true" />Kembali
          </Link>
        </Button>
      </div>
      <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cat-code" label="Kode" required error={form.errors.code} hint="Contoh: WINDOW, DOOR, BOUVEN">
            <Input value={form.data.code} onChange={(e) => form.setData("code", e.target.value.toUpperCase())} />
          </Field>
          <Field id="cat-name" label="Nama" required error={form.errors.name}>
            <Input value={form.data.name} onChange={(e) => form.setData("name", e.target.value)} />
          </Field>
          <Field id="cat-slug" label="Slug (URL)" required error={form.errors.slug} hint="Contoh: windows, doors, bouven">
            <Input value={form.data.slug} onChange={(e) => form.setData("slug", e.target.value.toLowerCase())} />
          </Field>
          <Field id="cat-order" label="Urutan" error={form.errors.sort_order}>
            <Input type="number" value={form.data.sort_order} onChange={(e) => form.setData("sort_order", Number(e.target.value))} />
          </Field>
        </div>
        <Field id="cat-seo-title" label="SEO Title" error={form.errors.seo_title}>
          <Input value={form.data.seo_title} onChange={(e) => form.setData("seo_title", e.target.value)} />
        </Field>
        <Field id="cat-seo-desc" label="SEO Description" error={form.errors.seo_description}>
          <Textarea rows={3} value={form.data.seo_description} onChange={(e) => form.setData("seo_description", e.target.value)} />
        </Field>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" checked={form.data.is_active} onChange={(e) => form.setData("is_active", e.target.checked)} className="h-4 w-4 accent-primary" />
          Kategori aktif
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={form.processing}>{form.processing ? "Menyimpan..." : "Simpan"}</Button>
          <Button asChild variant="ghost"><Link href={route("admin.categories.index")}>Batal</Link></Button>
        </div>
      </form>
    </AdminLayout>
  )
}
