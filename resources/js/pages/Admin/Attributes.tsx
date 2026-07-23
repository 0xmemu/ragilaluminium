import { Head, Link, useForm } from "@inertiajs/react"

import { Button } from "@/components/ui/button"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
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
    source: attribute.source,
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        form.put(attribute.updateUrl, { preserveScroll: true })
      }}
      className="grid gap-3 border-b border-border p-4 md:grid-cols-[1fr_1.3fr_8rem_auto] md:items-end"
    >
      <Field id={`attribute-name-${attribute.id}`} label="Nama" error={form.errors.attribute_name}>
        <Input value={form.data.attribute_name} onChange={(event) => form.setData("attribute_name", event.target.value)} />
      </Field>
      <Field id={`attribute-value-${attribute.id}`} label="Nilai" error={form.errors.attribute_value}>
        <Input value={form.data.attribute_value} onChange={(event) => form.setData("attribute_value", event.target.value)} />
      </Field>
      <Field id={`attribute-source-${attribute.id}`} label="Sumber" error={form.errors.source}>
        <Select value={form.data.source} onChange={(event) => form.setData("source", event.target.value)}>
          <option value="internal">Internal</option>
          <option value="shopee">Shopee</option>
        </Select>
      </Field>
      <Button type="submit" variant="secondary" disabled={form.processing}>
        {form.processing ? "..." : "Simpan"}
      </Button>
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
    source: "internal",
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.post(submitUrl, {
      preserveScroll: true,
      onSuccess: () => form.reset(),
    })
  }

  return (
    <AdminLayout
      title={`Atribut ${product.parent_sku}`}
      description={product.name}
      actions={
        <Button asChild variant="secondary">
          <Link href={routeUrl("admin.products.show", { product: product.id })}>Kembali ke produk</Link>
        </Button>
      }
    >
      <Head title={`Atribut ${product.parent_sku} | Admin`} />

      <section className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="border-b border-border p-5">
          <h2 className="text-xl font-semibold">Atribut produk</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Atribut publik dan internal yang melekat ke parent product.
          </p>
        </div>
        {attributes.length ? (
          <div>
            {attributes.map((attribute) => (
              <AttributeRow key={attribute.id} attribute={attribute} />
            ))}
          </div>
        ) : (
          <p className="p-8 text-sm text-muted-foreground">Belum ada atribut.</p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold">Tambah atribut</h2>
        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-[1fr_1.3fr_10rem_auto] md:items-end">
          <FormErrorSummary errors={form.errors} className="md:col-span-4" />
          <Field id="new-attribute-name" label="Nama" required error={form.errors.attribute_name}>
            <Input value={form.data.attribute_name} onChange={(event) => form.setData("attribute_name", event.target.value)} />
          </Field>
          <Field id="new-attribute-value" label="Nilai" required error={form.errors.attribute_value}>
            <Input value={form.data.attribute_value} onChange={(event) => form.setData("attribute_value", event.target.value)} />
          </Field>
          <Field id="new-attribute-source" label="Sumber" required error={form.errors.source}>
            <Select value={form.data.source} onChange={(event) => form.setData("source", event.target.value)}>
              <option value="internal">Internal</option>
              <option value="shopee">Shopee</option>
            </Select>
          </Field>
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Tambah"}
          </Button>
        </form>
      </section>
    </AdminLayout>
  )
}
