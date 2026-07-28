import { Head, Link, useForm } from "@inertiajs/react"

import { Button } from "@/components/ui/button"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { humanize } from "@/lib/format"

interface ModelRecord {
  id: number
  name: string
  product_category?: string | null
  product_model?: string | null
  image_url?: string | null
  description?: string | null
  type: string
  status: string
  sort_order: number
}

export default function ModelProductForm({
  modelProduct,
  types,
  statuses,
  categories,
  models,
  submitUrl,
  indexUrl,
}: {
  modelProduct: ModelRecord | null
  types: string[]
  statuses: string[]
  categories: Array<{ value: string; label: string }>
  models: Array<{ value: string; label: string }>
  submitUrl: string
  indexUrl: string
}) {
  const editing = Boolean(modelProduct)
  const form = useForm({
    name: modelProduct?.name ?? "",
    product_category: modelProduct?.product_category ?? "",
    product_model: modelProduct?.product_model ?? "",
    image_url: modelProduct?.image_url ?? "",
    description: modelProduct?.description ?? "",
    type: modelProduct?.type ?? types[0] ?? "polos",
    status: modelProduct?.status ?? "draft",
    sort_order: modelProduct?.sort_order ?? 0,
  })

  return (
    <AdminLayout
      title={editing ? "Edit model produk" : "Tambah model produk"}
      description="Tautkan ke kategori/model katalog agar statistik dan link storefront akurat."
      actions={
        <Button asChild variant="secondary">
          <Link href={indexUrl}>Batal</Link>
        </Button>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Model Produk | Admin`} />
      <form
        className="mx-auto max-w-3xl space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (editing) form.put(submitUrl)
          else form.post(submitUrl)
        }}
      >
        <FormErrorSummary errors={form.errors} />
        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="model-name" label="Nama tampilan" required error={form.errors.name} className="sm:col-span-2">
              <Input value={form.data.name} onChange={(event) => form.setData("name", event.target.value)} />
            </Field>
            <Field id="model-category" label="Kategori katalog" error={form.errors.product_category}>
              <Select
                value={form.data.product_category}
                onChange={(event) => form.setData("product_category", event.target.value)}
              >
                <option value="">— Pilih —</option>
                {categories.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Field id="model-code" label="Kode model katalog" error={form.errors.product_model}>
              <Select
                value={form.data.product_model}
                onChange={(event) => form.setData("product_model", event.target.value)}
              >
                <option value="">— Pilih —</option>
                {models.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Field id="model-type" label="Tipe desain" required error={form.errors.type}>
              <Select value={form.data.type} onChange={(event) => form.setData("type", event.target.value)}>
                {types.map((type) => (
                  <option key={type} value={type}>{humanize(type)}</option>
                ))}
              </Select>
            </Field>
            <Field id="model-status" label="Status" required error={form.errors.status}>
              <Select value={form.data.status} onChange={(event) => form.setData("status", event.target.value)}>
                {statuses.map((status) => (
                  <option key={status} value={status}>{humanize(status)}</option>
                ))}
              </Select>
            </Field>
            <Field id="model-image" label="URL gambar" error={form.errors.image_url} className="sm:col-span-2">
              <Input
                type="url"
                value={form.data.image_url}
                onChange={(event) => form.setData("image_url", event.target.value)}
              />
            </Field>
            {form.data.image_url ? (
              <img
                src={form.data.image_url}
                alt=""
                className="max-h-48 w-full border border-border object-cover sm:col-span-2"
              />
            ) : null}
            <Field
              id="model-description"
              label="Deskripsi model"
              hint="Tampil di halaman detail model storefront. Kosongkan untuk memakai teks default sistem."
              error={form.errors.description}
              className="sm:col-span-2"
            >
              <Textarea
                rows={5}
                value={form.data.description}
                onChange={(event) => form.setData("description", event.target.value)}
                placeholder="Contoh: Jendela sliding cocok untuk ruangan dengan bukaan lebar…"
              />
            </Field>
            <Field id="model-sort" label="Urutan" error={form.errors.sort_order}>
              <Input
                type="number"
                min="0"
                value={form.data.sort_order}
                onChange={(event) => form.setData("sort_order", Number(event.target.value))}
              />
            </Field>
          </div>
        </section>
        <div className="flex justify-end gap-2">
          <Button asChild variant="secondary"><Link href={indexUrl}>Batal</Link></Button>
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan model"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
