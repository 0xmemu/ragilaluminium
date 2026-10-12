import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Field, FieldAction, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"

interface AttributeRowData {
  id: number
  attribute_name: string
  attribute_value: string
  source: string
  updateUrl: string
}

function AttributeRow({ attribute }: { attribute: AttributeRowData }) {
  const form = useForm({
    attribute_name: attribute.attribute_name,
    attribute_value: attribute.attribute_value,
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        form.put(attribute.updateUrl, { preserveScroll: true })
      }}
      className="grid gap-3 border-b border-border p-4 sm:grid-cols-[1fr_1.5fr_auto] content-start"
    >
      <Field
        id={`attribute-name-${attribute.id}`}
        label="Nama spesifikasi"
        error={form.errors.attribute_name}
      >
        <Input
          value={form.data.attribute_name}
          onChange={(event) => form.setData("attribute_name", event.target.value)}
          placeholder="mis. Bahan, Kusen"
        />
      </Field>
      <Field
        id={`attribute-value-${attribute.id}`}
        label="Nilai spesifikasi"
        error={form.errors.attribute_value}
      >
        <Input
          value={form.data.attribute_value}
          onChange={(event) => form.setData("attribute_value", event.target.value)}
          placeholder="mis. Aluminium, 3 inch"
        />
      </Field>
      <FieldAction>
        <Button type="submit" variant="secondary" size="sm" disabled={form.processing}>
          {form.processing ? "Menyimpan..." : "Simpan"}
        </Button>
      </FieldAction>
    </form>
  )
}

export default function Attributes({
  product,
  attributes = [],
  submitUrl,
}: {
  product: { id: number; name: string; parent_sku: string }
  attributes: AttributeRowData[]
  submitUrl: string
}) {
  const form = useForm({
    attribute_name: "",
    attribute_value: "",
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.post(submitUrl, {
      preserveScroll: true,
      onSuccess: () => form.reset(),
    })
  }

  const backUrl = routeUrl("admin.products.show", { product: product.id, tab: "spesifikasi" })

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" form="attribute-create-form" disabled={form.processing}>
        {form.processing ? "Menyimpan..." : "Tambah"}
      </Button>
      <Button asChild variant="secondary">
        <Link href={backUrl}>Kembali ke produk</Link>
      </Button>
    </div>
  )

  return (
    <AdminLayout
      title={`Spesifikasi ${product.parent_sku}`}
      description={product.name}
      actions={actions}
      backUrl={backUrl}
    >
      <Head title={`Spesifikasi ${product.parent_sku} | Admin`} />

      <div className="mx-auto max-w-4xl space-y-6">
        <SectionCard
          title="Tambah spesifikasi baru"
          description="Spesifikasi tampil di etalase produk pada bagian Informasi produk pembeli."
          icon="plus"
        >
          <form id="attribute-create-form" onSubmit={submit} className="space-y-4">
            <FormErrorSummary errors={form.errors} />
            <FieldGrid>
              <Field
                id="new-attribute-name"
                label="Nama spesifikasi"
                required
                error={form.errors.attribute_name}
                hint="mis. Bahan, Kusen, Ketebalan Kaca, Merek"
              >
                <Input
                  value={form.data.attribute_name}
                  onChange={(event) => form.setData("attribute_name", event.target.value)}
                  placeholder="mis. Bahan"
                />
              </Field>
              <Field
                id="new-attribute-value"
                label="Nilai spesifikasi"
                required
                error={form.errors.attribute_value}
                hint="mis. Aluminium, 3 inch, 5mm, Inkalum"
              >
                <Input
                  value={form.data.attribute_value}
                  onChange={(event) => form.setData("attribute_value", event.target.value)}
                  placeholder="mis. Aluminium"
                />
              </Field>
            </FieldGrid>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={form.processing}>
                {form.processing ? "Menyimpan..." : "Tambah"}
              </Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Daftar spesifikasi produk"
          description={`${attributes.length} spesifikasi tersimpan untuk produk ini. Ubah langsung pada baris dan klik Simpan.`}
          icon="sliders"
          contentClassName="p-0"
        >
          {attributes.length ? (
            <div className="divide-y divide-border">
              {attributes.map((attribute) => (
                <AttributeRow key={attribute.id} attribute={attribute} />
              ))}
            </div>
          ) : (
            <div className="p-8">
              <EmptyState
                icon="sliders"
                title="Belum ada spesifikasi"
                description="Tambahkan spesifikasi di atas untuk melengkapi informasi produk ini."
              />
            </div>
          )}
        </SectionCard>
      </div>
    </AdminLayout>
  )
}
