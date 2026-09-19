import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { StatusSelect } from "@/components/admin/ui/status-select"
import AdminLayout from "@/layouts/admin-layout"

const VARIANT_STATUSES = ["active", "inactive", "archived"] as const

interface VariantEditData {
  variation_1_name: string
  variation_1_option: string
  variation_2_name: string
  variation_2_option: string
  price: number | string
  stock: number | string
  status: string
}

export default function VariantEdit({
  variant,
  submitUrl,
  backUrl,
}: {
  variant: VariantEditData & { id: number; product_id: number; variant_sku: string }
  submitUrl: string
  backUrl: string
}) {
  const form = useForm<VariantEditData>({
    variation_1_name: variant.variation_1_name ?? "",
    variation_1_option: variant.variation_1_option ?? "",
    variation_2_name: variant.variation_2_name ?? "",
    variation_2_option: variant.variation_2_option ?? "",
    price: variant.price,
    stock: variant.stock,
    status: variant.status,
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.put(submitUrl)
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" form="variant-form" disabled={form.processing}>
        {form.processing ? "Menyimpan..." : "Simpan varian"}
      </Button>
      <Button asChild variant="secondary">
        <Link href={backUrl}>Batal</Link>
      </Button>
    </div>
  )

  return (
    <AdminLayout
      title={`Edit Varian ${variant.variant_sku}`}
      description="Atur nama opsi, nilai kombinasi, harga, stok, dan status varian."
      actions={actions}
      backUrl={backUrl}
    >
      <Head title={`Edit ${variant.variant_sku} | Admin`} />

      <form id="variant-form" onSubmit={submit} className="mx-auto max-w-3xl space-y-6">
        <FormErrorSummary errors={form.errors} />

        <SectionCard
          title="Identitas & Opsi Kombinasi"
          description="Opsi varian menentukan kombinasi yang dipilih pembeli di etalase toko (misal Warna dan Kaca)."
          icon="package"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="edit-variant-sku"
              label="Variant SKU"
              hint="Dibuat otomatis dari SKU produk; tidak dapat diubah."
              className="sm:col-span-2"
            >
              <Input value={variant.variant_sku} readOnly disabled className="font-mono bg-muted/40" />
            </Field>

            <Field
              id="edit-variation_1_name"
              label="Nama Opsi 1 (mis. Warna)"
              error={form.errors.variation_1_name}
            >
              <Input
                value={form.data.variation_1_name}
                onChange={(event) => form.setData("variation_1_name", event.target.value)}
                placeholder="mis. Warna"
              />
            </Field>

            <Field
              id="edit-variation_1_option"
              label="Nilai Opsi 1 (mis. Putih)"
              error={form.errors.variation_1_option}
            >
              <Input
                value={form.data.variation_1_option}
                onChange={(event) => form.setData("variation_1_option", event.target.value)}
                placeholder="mis. Putih"
              />
            </Field>

            <Field
              id="edit-variation_2_name"
              label="Nama Opsi 2 (mis. Kaca)"
              error={form.errors.variation_2_name}
            >
              <Input
                value={form.data.variation_2_name}
                onChange={(event) => form.setData("variation_2_name", event.target.value)}
                placeholder="mis. Kaca"
              />
            </Field>

            <Field
              id="edit-variation_2_option"
              label="Nilai Opsi 2 (mis. Bening)"
              error={form.errors.variation_2_option}
            >
              <Input
                value={form.data.variation_2_option}
                onChange={(event) => form.setData("variation_2_option", event.target.value)}
                placeholder="mis. Bening"
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Harga, Stok & Status"
          description="Harga satuan dan stok tersedia untuk kombinasi varian ini."
          icon="hand-coins"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="edit-price"
              label="Harga Satuan (Rp)"
              required
              error={form.errors.price}
            >
              <Input
                type="number"
                min="0"
                step="100"
                value={form.data.price}
                onChange={(event) => form.setData("price", event.target.value)}
                placeholder="0"
              />
            </Field>

            <Field
              id="edit-stock"
              label="Stok Tersedia (unit)"
              required
              error={form.errors.stock}
            >
              <Input
                type="number"
                min="0"
                step="1"
                value={form.data.stock}
                onChange={(event) => form.setData("stock", event.target.value)}
                placeholder="0"
              />
            </Field>

            <Field
              id="edit-variant-status"
              label="Status Varian"
              required
              error={form.errors.status}
              className="sm:col-span-2"
              hint="Varian Aktif tampil di etalase pembeli; Tidak Aktif atau Diarsipkan disembunyikan."
            >
              <StatusSelect
                statuses={VARIANT_STATUSES}
                value={form.data.status}
                onChange={(event) => form.setData("status", event.target.value)}
              />
            </Field>
          </div>
        </SectionCard>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button asChild variant="secondary">
            <Link href={backUrl}>Batal</Link>
          </Button>
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan varian"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
