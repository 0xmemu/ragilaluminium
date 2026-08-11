import { Head, Link, useForm } from "@inertiajs/react"

import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"

interface TestimonialRecord {
  id: number
  customer_name: string
  message?: string | null
  rating?: number | null
  source: string
  location?: string | null
  product_id?: number | null
  image_url?: string | null
  sort_order: number
  published: boolean
}

const DEFAULT_SOURCE_LABELS: Record<string, string> = {
  shopee: "Shopee",
  whatsapp: "WhatsApp",
  website: "Website",
  other: "Lainnya",
}

export default function TestimonialForm({
  testimonial,
  products,
  sources,
  sourceLabels,
  intent = "website",
  submitUrl,
  indexUrl,
}: {
  testimonial: TestimonialRecord | null
  products: Array<{ id: number; label: string }>
  sources: string[]
  sourceLabels?: Record<string, string>
  intent?: "marketplace" | "website"
  submitUrl: string
  indexUrl: string
}) {
  const editing = Boolean(testimonial)
  const labels = sourceLabels ?? DEFAULT_SOURCE_LABELS
  const isMarketplaceIntent = intent === "marketplace"
  const form = useForm<{
    customer_name: string
    message: string
    rating: string
    source: string
    location: string
    product_id: string
    image_url: string
    image: File | null
    sort_order: number
    published: boolean
  }>({
    customer_name: testimonial?.customer_name ?? "",
    message: testimonial?.message ?? "",
    rating: testimonial?.rating?.toString() ?? "",
    source: testimonial?.source ?? sources[0] ?? (isMarketplaceIntent ? "shopee" : "website"),
    location: testimonial?.location ?? "",
    product_id: testimonial?.product_id?.toString() ?? "",
    image_url: testimonial?.image_url ?? "",
    image: null,
    sort_order: testimonial?.sort_order ?? 0,
    published: testimonial?.published ?? false,
  })

  const isMarketplace = ["shopee", "whatsapp"].includes(form.data.source) || isMarketplaceIntent

  return (
    <AdminLayout
      title={
        editing
          ? isMarketplaceIntent
            ? "Edit screenshot"
            : "Edit ulasan"
          : isMarketplaceIntent
            ? "Tambah screenshot"
            : "Tambah ulasan"
      }
      description={
        isMarketplaceIntent
          ? "Screenshot percakapan Shopee atau WhatsApp di luar transaksi website. Gambar wajib."
          : "Ulasan pembeli website: teks dan/atau gambar (boleh SS WA bila pelanggan tidak menulis ulasan)."
      }
      actions={
        <Button asChild variant="secondary">
          <Link href={indexUrl}>Batal</Link>
        </Button>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} ${isMarketplaceIntent ? "Screenshot" : "Ulasan"} | Admin`} />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (editing) {
            form.transform((data) => ({ ...data, _method: "put" }))
            form.post(submitUrl, { forceFormData: true })
          } else {
            form.post(submitUrl, { forceFormData: true })
          }
        }}
        className="mx-auto max-w-3xl space-y-6"
        encType="multipart/form-data"
      >
        <FormErrorSummary errors={form.errors} />
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Stripe media: thumbnail kiri, upload + URL inline kanan */}
          <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-start">
            <div className="size-24 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
              {form.data.image_url || form.data.image ? (
                <img
                  src={form.data.image ? URL.createObjectURL(form.data.image) : form.data.image_url}
                  alt="Pratinjau"
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground/60">
                  <span className="text-[10px]">Tanpa gambar</span>
                </div>
              )}
            </div>
            <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
              <Field
                id="testimonial-image-file"
                label="Unggah screenshot"
                error={form.errors.image}
                hint={
                  isMarketplace
                    ? "Wajib. Screenshot Shopee/WhatsApp (max 5MB)."
                    : "Opsional. Max 5MB. Mengunggah mengganti URL di samping."
                }
                required={isMarketplace}
              >
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => form.setData("image", event.target.files?.[0] ?? null)}
                />
              </Field>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <Field id="testimonial-customer" label="Nama pelanggan" required error={form.errors.customer_name}>
              <Input value={form.data.customer_name} onChange={(event) => form.setData("customer_name", event.target.value)} />
            </Field>
            <Field id="testimonial-location" label="Lokasi" error={form.errors.location}>
              <Input value={form.data.location} onChange={(event) => form.setData("location", event.target.value)} />
            </Field>
            {!isMarketplaceIntent ? (
              <Field
                id="testimonial-message"
                label="Isi ulasan"
                error={form.errors.message}
                className="sm:col-span-2"
                hint="Opsional jika ada gambar. Wajib salah satu: teks atau gambar."
              >
                <Textarea rows={7} value={form.data.message} onChange={(event) => form.setData("message", event.target.value)} />
              </Field>
            ) : (
              <Field
                id="testimonial-message"
                label="Deskripsi (opsional)"
                error={form.errors.message}
                className="sm:col-span-2"
                hint="Tidak wajib. Storefront menampilkan screenshot, bukan teks panjang."
              >
                <Textarea rows={3} value={form.data.message} onChange={(event) => form.setData("message", event.target.value)} />
              </Field>
            )}
            {!isMarketplaceIntent ? (
              <Field id="testimonial-rating" label="Rating" error={form.errors.rating}>
                <Select value={form.data.rating} onChange={(event) => form.setData("rating", event.target.value)}>
                  <option value="">Tanpa rating</option>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <option key={rating} value={rating}>{rating} bintang</option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field
              id="testimonial-source"
              label="Sumber / kanal"
              required
              error={form.errors.source}
              hint={
                isMarketplace
                  ? "Tampil di section Apa kata pelanggan kami (screenshot)."
                  : "Tampil di section Ulasan pelanggan di website."
              }
            >
              <Select value={form.data.source} onChange={(event) => form.setData("source", event.target.value)}>
                {sources.map((source) => (
                  <option key={source} value={source}>{labels[source] ?? source}</option>
                ))}
              </Select>
            </Field>
            {!isMarketplaceIntent ? (
              <Field id="testimonial-product" label="Produk terkait" error={form.errors.product_id} className="sm:col-span-2">
                <Select value={form.data.product_id} onChange={(event) => form.setData("product_id", event.target.value)}>
                  <option value="">Ulasan umum (/reviews saja)</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.label}</option>
                  ))}
                </Select>
              </Field>
            ) : null}
            {!isMarketplaceIntent ? (
              <Field id="testimonial-sort" label="Urutan" error={form.errors.sort_order}>
                <Input
                  type="number"
                  min="0"
                  value={form.data.sort_order}
                  onChange={(event) => form.setData("sort_order", Number(event.target.value))}
                />
              </Field>
            ) : (
              <p className="sm:col-span-2 text-sm text-muted-foreground">
                Urutan tampilan diatur di daftar Apa Kata Pelanggan lewat tombol <strong>Atur urutan</strong>.
              </p>
            )}
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-medium sm:self-end">
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
            {form.processing ? "Menyimpan..." : isMarketplaceIntent ? "Simpan screenshot" : "Simpan ulasan"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
