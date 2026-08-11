import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"


import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { Textarea } from "@/components/admin/ui/textarea"

import AdminLayout from "@/layouts/admin-layout"

interface SubModelData {
  id?: number
  product_model: string
  code: string
  name: string
  description?: string | null
  image_url?: string | null
  is_active: boolean
}

export default function SubModelForm({
  title,
  subModel,
  productModel,
  modelOptions,
  submitUrl,
  indexUrl,
}: {
  title: string
  subModel: SubModelData | null
  productModel: string
  modelOptions: Array<{ value: string; label: string }>
  submitUrl: string
  indexUrl: string
}) {
  const editing = Boolean(subModel)
  const form = useForm<SubModelData>({
    product_model: subModel?.product_model ?? productModel,
    code: subModel?.code ?? "",
    name: subModel?.name ?? "",
    description: subModel?.description ?? "",
    image_url: subModel?.image_url ?? "",
    is_active: subModel?.is_active ?? true,
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (editing) {
      form.put(submitUrl)
    } else {
      form.post(submitUrl)
    }
  }

  return (
    <AdminLayout title={title} description={editing ? `Sub model ${subModel?.code ?? ""}` : "Sub model baru untuk model produk."}>
      <Head title={title} />
      <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
        <FormErrorSummary errors={form.errors} />
        <Card>
          <div className="space-y-4 p-5 sm:p-7">
            <Field id="sub-model-model" label="Model produk" required error={form.errors.product_model}>
              <Select
                value={form.data.product_model}
                onChange={(event) => {
                  form.setData("product_model", event.target.value)
                }}
                disabled={editing}
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field id="sub-model-code" label="Kode (dipakai di URL & data produk)" required error={form.errors.code}>
              <Input
                value={form.data.code}
                onChange={(event) => form.setData("code", event.target.value)}
                placeholder="contoh: JALUSI, SERIES_D"
                className="font-mono"
                disabled={editing}
              />
              {editing ? (
                <p className="mt-1 text-xs text-muted-foreground">Kode tidak bisa diubah setelah dibuat.</p>
              ) : null}
            </Field>

            <Field id="sub-model-name" label="Nama sub model" required error={form.errors.name}>
              <Input value={form.data.name} onChange={(event) => form.setData("name", event.target.value)} placeholder="contoh: Jalusi" />
            </Field>

            <Field id="sub-model-description" label="Deskripsi" error={form.errors.description}>
              <Textarea
                rows={3}
                value={form.data.description ?? ""}
                onChange={(event) => form.setData("description", event.target.value)}
              />
            </Field>

            <Field id="sub-model-image" label="URL gambar" error={form.errors.image_url}>
              <Input
                value={form.data.image_url ?? ""}
                onChange={(event) => form.setData("image_url", event.target.value)}
                placeholder="https://..."
                className="font-mono"
              />
            </Field>

            {editing ? (
              <Field id="sub-model-active" label="Status">
                <Select
                  value={form.data.is_active ? "active" : "inactive"}
                  onChange={(event) => form.setData("is_active", event.target.value === "active")}
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </Select>
              </Field>
            ) : null}
          </div>
        </Card>

        <div className="flex flex-wrap justify-between gap-3">
          <Button asChild variant="secondary">
            <Link href={indexUrl}>Batal</Link>
          </Button>
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : editing ? "Simpan perubahan" : "Tambah sub model"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
