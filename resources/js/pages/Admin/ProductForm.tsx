import { Head, Link, useForm } from "@inertiajs/react"

import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import type { SelectOption } from "@/types"

interface ProductFormData {
  name: string
  short_name: string
  description: string
  category_id: number | string
  product_category: string
  product_model: string
  design_variant: string
  status: string
  homepage_popular: boolean
  homepage_popular_sort: number | string
  create_initial_variant: boolean
  initial_price: number | string
  initial_stock: number | string
}

interface ProductRecord extends ProductFormData {
  id: number
  parent_sku: string
}

export default function ProductForm({
  product,
  submitUrl,
  options,
}: {
  product: ProductRecord | null
  submitUrl: string
  options: {
    categories: SelectOption[]
    models: SelectOption[]
    designs: SelectOption[]
    statuses: SelectOption[]
  }
}) {
  const editing = Boolean(product)
  const form = useForm<ProductFormData>({
    name: product?.name ?? "",
    short_name: product?.short_name ?? "",
    description: product?.description ?? "",
    category_id: product?.category_id ?? "",
    product_category: product?.product_category ?? options.categories[0]?.value ?? "WINDOW",
    product_model: product?.product_model ?? options.models[0]?.value ?? "SLIDING",
    design_variant: product?.design_variant ?? options.designs[0]?.value ?? "POLOS",
    status: product?.status ?? "draft",
    homepage_popular: product?.homepage_popular ?? false,
    homepage_popular_sort: product?.homepage_popular_sort ?? 0,
    create_initial_variant: false,
    initial_price: "",
    initial_stock: 0,
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (editing) form.put(submitUrl)
    else form.post(submitUrl)
  }

  return (
    <AdminLayout
      title={editing ? "Edit produk" : "Tambah produk"}
      description={
        editing
          ? `Perbarui data dasar ${product?.parent_sku}.`
          : "SKU parent dan varian dibuat otomatis (prefix WEB, bukan SP Shopee). Isi identitas produk lalu simpan."
      }
      actions={
        <Button asChild variant="secondary">
          <Link href={routeUrl("admin.products.index")}>Batal</Link>
        </Button>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Produk | Admin`} />
      <form onSubmit={submit} className="mx-auto max-w-4xl space-y-6">
        <FormErrorSummary errors={form.errors} />

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-semibold">Identitas produk</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {editing ? (
              <Field
                id="product-parent-sku"
                label="Parent SKU"
                hint="Dibuat otomatis saat produk pertama kali disimpan; tidak dapat diubah."
              >
                <Input value={product?.parent_sku ?? ""} readOnly disabled className="font-mono" />
              </Field>
            ) : (
              <Field
                id="product-parent-sku"
                label="Parent SKU"
                hint="Prefix WEB: produk buatan website, terpisah dari import Shopee (SP)."
              >
                <Input value="(otomatis)" readOnly disabled className="font-mono text-muted-foreground" />
              </Field>
            )}
            <Field
              id="product-category-id"
              label="Category ID"
              required
              error={form.errors.category_id}
            >
              <Input
                type="number"
                min="1"
                value={form.data.category_id}
                onChange={(event) => form.setData("category_id", event.target.value)}
              />
            </Field>
            <Field id="product-name" label="Nama produk" required error={form.errors.name} className="sm:col-span-2">
              <Input
                value={form.data.name}
                onChange={(event) => form.setData("name", event.target.value)}
              />
            </Field>
            <Field id="product-short-name" label="Nama pendek" error={form.errors.short_name} className="sm:col-span-2">
              <Input
                value={form.data.short_name}
                onChange={(event) => form.setData("short_name", event.target.value)}
              />
            </Field>
            <Field id="product-description" label="Deskripsi" error={form.errors.description} className="sm:col-span-2">
              <Textarea
                rows={6}
                value={form.data.description}
                onChange={(event) => form.setData("description", event.target.value)}
              />
            </Field>
          </div>
        </section>

        {!editing ? (
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-semibold">Varian awal dan stok</h2>
            <label className="mt-5 flex cursor-pointer items-start gap-3 bg-surface-muted p-4">
              <input
                type="checkbox"
                checked={form.data.create_initial_variant}
                onChange={(event) => form.setData("create_initial_variant", event.target.checked)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-semibold">Buat varian awal sekarang</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  Aktifkan untuk langsung memasukkan harga dan stok manual saat produk dibuat.
                  Varian lain tetap dapat ditambahkan dari halaman Kelola varian.
                </span>
              </span>
            </label>

            {form.data.create_initial_variant ? (
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Field
                  id="product-initial-price"
                  label="Harga"
                  required
                  error={form.errors.initial_price}
                >
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.data.initial_price}
                    onChange={(event) => form.setData("initial_price", event.target.value)}
                  />
                </Field>
                <Field
                  id="product-initial-stock"
                  label="Stok manual"
                  required
                  error={form.errors.initial_stock}
                >
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={form.data.initial_stock}
                    onChange={(event) => form.setData("initial_stock", event.target.value)}
                  />
                </Field>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-semibold">Taksonomi dan status</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field id="product-category" label="Kategori" required error={form.errors.product_category}>
              <Select
                value={form.data.product_category}
                onChange={(event) => form.setData("product_category", event.target.value)}
              >
                {options.categories.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Field id="product-model" label="Model" required error={form.errors.product_model}>
              <Select
                value={form.data.product_model}
                onChange={(event) => form.setData("product_model", event.target.value)}
              >
                {options.models.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Field id="product-design" label="Desain" required error={form.errors.design_variant}>
              <Select
                value={form.data.design_variant}
                onChange={(event) => form.setData("design_variant", event.target.value)}
              >
                {options.designs.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Field id="product-status" label="Status" required error={form.errors.status}>
              <Select
                value={form.data.status}
                onChange={(event) => form.setData("status", event.target.value)}
              >
                {options.statuses.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-semibold">Beranda</h2>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-md bg-surface-muted p-4">
            <input
              type="checkbox"
              checked={form.data.homepage_popular}
              onChange={(event) => form.setData("homepage_popular", event.target.checked)}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-semibold">Tampilkan sebagai paling banyak dipesan</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                Gunakan hanya untuk produk yang memang ingin diprioritaskan pada beranda.
              </span>
            </span>
          </label>
          <Field
            id="product-popular-sort"
            label="Urutan tampilan"
            error={form.errors.homepage_popular_sort}
            className="mt-5 max-w-48"
          >
            <Input
              type="number"
              min="0"
              max="9999"
              value={form.data.homepage_popular_sort}
              onChange={(event) => form.setData("homepage_popular_sort", event.target.value)}
              disabled={!form.data.homepage_popular}
            />
          </Field>
        </section>

        <div className="flex justify-end gap-2 border-t border-border pt-6">
          <Button asChild variant="secondary">
            <Link href={routeUrl("admin.products.index")}>Batal</Link>
          </Button>
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan produk"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
