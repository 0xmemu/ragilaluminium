import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency } from "@/lib/format"

interface ProductOption {
  id: number
  parent_sku: string
  name: string
  min_price: number | null
}

interface FlashProduct {
  id: number
  parent_sku: string
  name: string
  min_price: number | null
  compare_price: number | null
  flash_sale: boolean
}

export default function FlashSaleForm({
  product,
  productOptions,
  submitUrl,
  method,
  indexHref,
}: {
  product: FlashProduct | null
  productOptions: ProductOption[]
  submitUrl: string
  method: "post" | "put"
  indexHref: string
}) {
  const isEdit = Boolean(product?.id)
  const form = useForm<{
    product_id: number | ""
    flash_sale: boolean
    compare_price: string
  }>({
    product_id: product?.id ?? "",
    flash_sale: product?.flash_sale ?? true,
    compare_price:
      product?.compare_price !== null && product?.compare_price !== undefined
        ? String(product.compare_price)
        : "",
  })

  const selected = productOptions.find((row) => row.id === Number(form.data.product_id))
  const minPrice = product?.min_price ?? selected?.min_price ?? null

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const payload = {
      product_id: form.data.product_id === "" ? null : Number(form.data.product_id),
      flash_sale: form.data.flash_sale,
      compare_price: form.data.compare_price.trim() === "" ? null : Number(form.data.compare_price),
    }

    if (method === "post") {
      form.transform(() => payload)
      form.post(submitUrl)
      return
    }

    form.transform(() => payload)
    form.put(submitUrl)
  }

  return (
    <AdminLayout
      title={isEdit ? "Edit Flash Sale" : "Tambah Flash Sale"}
      description="Menulis atribut internal promo_flash_sale dan promo_compare_price pada produk."
      actions={
        <Button asChild variant="secondary">
          <Link href={indexHref}>Kembali ke daftar</Link>
        </Button>
      }
    >
      <Head title={`${isEdit ? "Edit" : "Tambah"} Flash Sale | Admin`} />

      <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <FormErrorSummary errors={form.errors} />

        <section className="space-y-4">
          <h2 className="text-base font-bold">Produk</h2>
          {isEdit ? (
            <div>
              <p className="text-sm font-semibold">{product?.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{product?.parent_sku}</p>
              {minPrice !== null ? (
                <p className="mt-1 text-sm tabular-nums">Harga jual: {formatCurrency(minPrice)}</p>
              ) : null}
            </div>
          ) : (
            <Field id="product_id" label="Pilih produk" error={form.errors.product_id}>
              <Select
                id="product_id"
                value={form.data.product_id === "" ? "" : String(form.data.product_id)}
                onChange={(event) =>
                  form.setData("product_id", event.target.value ? Number(event.target.value) : "")
                }
                required
              >
                <option value="">— Pilih produk aktif —</option>
                {productOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.parent_sku})
                    {option.min_price !== null ? ` · ${formatCurrency(option.min_price)}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-bold">Promo</h2>
          <Field
            id="compare_price"
            label="Harga coret (promo_compare_price)"
            error={form.errors.compare_price}
            hint="Opsional. Harus lebih besar dari harga jual agar chip diskon muncul di storefront."
          >
            <Input
              id="compare_price"
              type="number"
              min={0}
              step="0.01"
              value={form.data.compare_price}
              onChange={(event) => form.setData("compare_price", event.target.value)}
              placeholder={minPrice !== null ? String(Math.round(minPrice * 1.2)) : "Contoh: 1500000"}
            />
          </Field>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-4 rounded border-border"
              checked={form.data.flash_sale}
              onChange={(event) => form.setData("flash_sale", event.target.checked)}
            />
            Aktifkan Flash Sale (promo_flash_sale = true)
          </label>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : isEdit ? "Simpan perubahan" : "Tambah Flash Sale"}
          </Button>
          <Button asChild type="button" variant="secondary">
            <Link href={indexHref}>Batal</Link>
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
