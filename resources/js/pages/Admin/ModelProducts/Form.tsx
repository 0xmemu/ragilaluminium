import { Head, Link, useForm } from "@inertiajs/react"

import { Button } from "@/components/ui/button"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { humanize } from "@/lib/format"

interface ContentPayload {
  description?: string | null
  hero_caption?: string | null
  hero_image_url?: string | null
  benefits?: Array<{ icon?: string; title?: string }>
  specs?: Array<{ label?: string; value?: string }>
}

interface ModelRecord {
  id: number
  name: string
  product_category?: string | null
  product_model?: string | null
  image_url?: string | null
  content?: ContentPayload | null
  type: string
  status: string
  sort_order: number
}

const DEFAULT_BENEFITS = [
  { icon: "badge-check", title: "Kualitas terbaik dan terjamin" },
  { icon: "sun", title: "Tahan panas dan cuaca" },
  { icon: "shield-check", title: "Dukungan dan garansi pemasangan" },
]

const DEFAULT_SPECS = [
  { label: "Kategori", value: "" },
  { label: "Model", value: "" },
  { label: "Frame", value: "Aluminium" },
  { label: "Tipe", value: "" },
]

function normalizeBenefits(content?: ContentPayload | null) {
  const rows = content?.benefits?.length ? content.benefits : DEFAULT_BENEFITS
  return [0, 1, 2].map((index) => ({
    icon: rows[index]?.icon || DEFAULT_BENEFITS[index].icon,
    title: rows[index]?.title || "",
  }))
}

function normalizeSpecs(content?: ContentPayload | null) {
  const rows = content?.specs?.length ? content.specs : DEFAULT_SPECS
  return [0, 1, 2, 3].map((index) => ({
    label: rows[index]?.label || DEFAULT_SPECS[index].label,
    value: rows[index]?.value || "",
  }))
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
    type: modelProduct?.type ?? types[0] ?? "polos",
    status: modelProduct?.status ?? "draft",
    sort_order: modelProduct?.sort_order ?? 0,
    content: {
      description: modelProduct?.content?.description ?? "",
      hero_caption: modelProduct?.content?.hero_caption ?? "",
      hero_image_url: modelProduct?.content?.hero_image_url ?? "",
      benefits: normalizeBenefits(modelProduct?.content),
      specs: normalizeSpecs(modelProduct?.content),
    },
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
            <Field id="model-image" label="URL gambar kartu" error={form.errors.image_url} className="sm:col-span-2">
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
                className="max-h-48 w-full rounded-lg border border-border object-cover sm:col-span-2"
              />
            ) : null}
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

        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
          <h2 className="text-base font-semibold text-foreground">Konten halaman penjelasan model</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kosongkan untuk memakai teks default storefront. Halaman publik:{" "}
            <code className="text-xs">/model/&#123;kategori&#125;/&#123;model&#125;</code>
          </p>
          <div className="mt-5 grid gap-5">
            <Field id="content-description" label="Deskripsi (Detail Pemasangan)" error={form.errors["content.description" as keyof typeof form.errors]}>
              <Textarea
                rows={4}
                value={form.data.content.description}
                onChange={(event) =>
                  form.setData("content", { ...form.data.content, description: event.target.value })
                }
              />
            </Field>
            <Field id="content-caption" label="Caption hero" error={form.errors["content.hero_caption" as keyof typeof form.errors]}>
              <Input
                value={form.data.content.hero_caption}
                onChange={(event) =>
                  form.setData("content", { ...form.data.content, hero_caption: event.target.value })
                }
                placeholder="Mis. Modern Living Residence - Jakarta Selatan"
              />
            </Field>
            <Field id="content-hero-image" label="URL gambar hero (opsional)" error={form.errors["content.hero_image_url" as keyof typeof form.errors]}>
              <Input
                type="url"
                value={form.data.content.hero_image_url}
                onChange={(event) =>
                  form.setData("content", { ...form.data.content, hero_image_url: event.target.value })
                }
              />
            </Field>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Manfaat (3 kartu)</p>
              {form.data.content.benefits.map((benefit, index) => (
                <Field
                  key={`benefit-${index}`}
                  id={`benefit-title-${index}`}
                  label={`Kartu ${index + 1}`}
                  error={form.errors[`content.benefits.${index}.title` as keyof typeof form.errors]}
                >
                  <Input
                    value={benefit.title}
                    onChange={(event) => {
                      const benefits = form.data.content.benefits.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, title: event.target.value } : row,
                      )
                      form.setData("content", { ...form.data.content, benefits })
                    }}
                  />
                </Field>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Spesifikasi unit</p>
              {form.data.content.specs.map((spec, index) => (
                <div key={`spec-${index}`} className="grid gap-3 sm:grid-cols-2">
                  <Field
                    id={`spec-label-${index}`}
                    label={`Label ${index + 1}`}
                    error={form.errors[`content.specs.${index}.label` as keyof typeof form.errors]}
                  >
                    <Input
                      value={spec.label}
                      onChange={(event) => {
                        const specs = form.data.content.specs.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, label: event.target.value } : row,
                        )
                        form.setData("content", { ...form.data.content, specs })
                      }}
                    />
                  </Field>
                  <Field
                    id={`spec-value-${index}`}
                    label={`Nilai ${index + 1}`}
                    error={form.errors[`content.specs.${index}.value` as keyof typeof form.errors]}
                  >
                    <Input
                      value={spec.value}
                      onChange={(event) => {
                        const specs = form.data.content.specs.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, value: event.target.value } : row,
                        )
                        form.setData("content", { ...form.data.content, specs })
                      }}
                    />
                  </Field>
                </div>
              ))}
            </div>
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
