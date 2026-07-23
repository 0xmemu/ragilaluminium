import { Head, Link, useForm } from "@inertiajs/react"

import { Button } from "@/components/ui/button"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { humanize } from "@/lib/format"

interface TestimonialRecord {
  id: number
  customer_name: string
  message: string
  rating?: number | null
  source: string
  location?: string | null
  product_id?: number | null
  image_url?: string | null
  sort_order: number
  published: boolean
}

export default function TestimonialForm({
  testimonial,
  products,
  sources,
  submitUrl,
  indexUrl,
}: {
  testimonial: TestimonialRecord | null
  products: Array<{ id: number; label: string }>
  sources: string[]
  submitUrl: string
  indexUrl: string
}) {
  const editing = Boolean(testimonial)
  const form = useForm({
    customer_name: testimonial?.customer_name ?? "",
    message: testimonial?.message ?? "",
    rating: testimonial?.rating?.toString() ?? "",
    source: testimonial?.source ?? sources[0] ?? "website",
    location: testimonial?.location ?? "",
    product_id: testimonial?.product_id?.toString() ?? "",
    image_url: testimonial?.image_url ?? "",
    sort_order: testimonial?.sort_order ?? 0,
    published: testimonial?.published ?? false,
  })

  return (
    <AdminLayout
      title={editing ? "Edit ulasan website" : "Tambah ulasan website"}
      description="Ulasan hanya tampil di storefront jika published. Opsional tautkan ke produk untuk tab Ulasan di PDP."
      actions={
        <Button asChild variant="secondary">
          <Link href={indexUrl}>Batal</Link>
        </Button>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Ulasan | Admin`} />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (editing) form.put(submitUrl)
          else form.post(submitUrl)
        }}
        className="mx-auto max-w-3xl space-y-6"
      >
        <FormErrorSummary errors={form.errors} />
        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="testimonial-customer" label="Nama pelanggan" required error={form.errors.customer_name}>
              <Input value={form.data.customer_name} onChange={(event) => form.setData("customer_name", event.target.value)} />
            </Field>
            <Field id="testimonial-location" label="Lokasi" error={form.errors.location}>
              <Input value={form.data.location} onChange={(event) => form.setData("location", event.target.value)} />
            </Field>
            <Field id="testimonial-message" label="Isi ulasan" required error={form.errors.message} className="sm:col-span-2">
              <Textarea rows={7} value={form.data.message} onChange={(event) => form.setData("message", event.target.value)} />
            </Field>
            <Field id="testimonial-rating" label="Rating" error={form.errors.rating}>
              <Select value={form.data.rating} onChange={(event) => form.setData("rating", event.target.value)}>
                <option value="">Tanpa rating</option>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <option key={rating} value={rating}>{rating} bintang</option>
                ))}
              </Select>
            </Field>
            <Field id="testimonial-source" label="Sumber" required error={form.errors.source}>
              <Select value={form.data.source} onChange={(event) => form.setData("source", event.target.value)}>
                {sources.map((source) => (
                  <option key={source} value={source}>{humanize(source)}</option>
                ))}
              </Select>
            </Field>
            <Field id="testimonial-product" label="Produk terkait" error={form.errors.product_id} className="sm:col-span-2">
              <Select value={form.data.product_id} onChange={(event) => form.setData("product_id", event.target.value)}>
                <option value="">Ulasan umum (/reviews saja)</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.label}</option>
                ))}
              </Select>
            </Field>
            <Field id="testimonial-image" label="URL gambar" error={form.errors.image_url} className="sm:col-span-2">
              <Input type="url" value={form.data.image_url} onChange={(event) => form.setData("image_url", event.target.value)} />
            </Field>
            <Field id="testimonial-sort" label="Urutan" error={form.errors.sort_order}>
              <Input
                type="number"
                min="0"
                value={form.data.sort_order}
                onChange={(event) => form.setData("sort_order", Number(event.target.value))}
              />
            </Field>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold sm:self-end">
              <input
                type="checkbox"
                checked={form.data.published}
                onChange={(event) => form.setData("published", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Tampilkan di storefront
            </label>
          </div>
        </section>
        <div className="flex justify-end gap-2">
          <Button asChild variant="secondary"><Link href={indexUrl}>Batal</Link></Button>
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan ulasan"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
