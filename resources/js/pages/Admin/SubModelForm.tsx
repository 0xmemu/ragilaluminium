import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { Textarea } from "@/components/admin/ui/textarea"

import AdminLayout from "@/layouts/admin-layout"

interface TemplateRow {
  attribute_name: string
  attribute_value: string
}

interface SubModelData {
  id?: number
  product_model: string
  code: string
  name: string
  description?: string | null
  image_url?: string | null
  is_active: boolean
  templates?: TemplateRow[]
  model_templates?: TemplateRow[]
}

export default function SubModelForm({
  title,
  subModel,
  attributeTemplates = [],
  modelTemplates = [],
  productModel,
  modelOptions,
  submitUrl,
  indexUrl,
  backUrl,
}: {
  title: string
  subModel: SubModelData | null
  attributeTemplates?: Array<TemplateRow & { id?: number }>
  modelTemplates?: Array<TemplateRow & { id?: number }>
  productModel: string
  modelOptions: Array<{ value: string; label: string }>
  submitUrl: string
  indexUrl: string
  backUrl?: string | null
}) {
  const editing = Boolean(subModel)
  const form = useForm<SubModelData>({
    product_model: subModel?.product_model ?? productModel,
    code: subModel?.code ?? "",
    name: subModel?.name ?? "",
    description: subModel?.description ?? "",
    image_url: subModel?.image_url ?? "",
    is_active: subModel?.is_active ?? true,
    templates: attributeTemplates.map((row) => ({
      attribute_name: row.attribute_name,
      attribute_value: row.attribute_value,
    })),
    model_templates: modelTemplates.map((row) => ({
      attribute_name: row.attribute_name,
      attribute_value: row.attribute_value,
    })),
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (editing) {
      form.put(submitUrl)
    } else {
      form.post(submitUrl)
    }
  }

  function updateTemplate(index: number, key: keyof TemplateRow, value: string) {
    const next = (form.data.templates ?? []).map((row, rowIndex) =>
      rowIndex === index ? { ...row, [key]: value } : row,
    )
    form.setData("templates", next)
  }

  return (
    <AdminLayout
      backUrl={backUrl}
      title={title}
      description={editing ? `Sub model ${subModel?.code ?? ""}` : "Sub model baru untuk model produk."}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={indexUrl}>Batal</Link>
          </Button>
          <Button type="submit" form="sub-model-form" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : editing ? "Simpan perubahan" : "Tambah sub model"}
          </Button>
        </div>
      }
    >
      <Head title={title} />
      <form id="sub-model-form" onSubmit={submit} className="w-full space-y-5">
        <FormErrorSummary errors={form.errors} />

        {/* Table-first: satu baris per field */}
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Model produk <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <Select
                    value={form.data.product_model}
                    onChange={(event) => {
                      form.setData("product_model", event.target.value)
                    }}
                    disabled={editing}
                    className="h-8 text-xs"
                  >
                    {modelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  {form.errors.product_model ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.product_model}</p>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Kode (dipakai di URL &amp; data produk) <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    value={form.data.code}
                    onChange={(event) => form.setData("code", event.target.value)}
                    placeholder="contoh: JALUSI, SERIES_D"
                    className="h-8 w-72 text-xs font-mono"
                    disabled={editing}
                  />
                  {form.errors.code ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.code}</p>
                  ) : null}
                  {editing ? (
                    <p className="mt-1 text-xs text-muted-foreground">Kode tidak bisa diubah setelah dibuat.</p>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Nama sub model <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    value={form.data.name}
                    onChange={(event) => form.setData("name", event.target.value)}
                    placeholder="contoh: Jalusi"
                    className="h-8 w-72 text-xs"
                  />
                  {form.errors.name ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.name}</p>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Deskripsi</th>
                <td className="px-4 py-2.5">
                  <Textarea
                    rows={2}
                    value={form.data.description ?? ""}
                    onChange={(event) => form.setData("description", event.target.value)}
                    className="text-xs"
                  />
                  {form.errors.description ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.description}</p>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">URL gambar</th>
                <td className="px-4 py-2.5">
                  <Input
                    value={form.data.image_url ?? ""}
                    onChange={(event) => form.setData("image_url", event.target.value)}
                    placeholder="https://..."
                    className="h-8 w-96 text-xs font-mono"
                  />
                  {form.errors.image_url ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.image_url}</p>
                  ) : null}
                </td>
              </tr>
              {editing ? (
                <tr>
                  <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Status</th>
                  <td className="px-4 py-2.5">
                    <Select
                      value={form.data.is_active ? "active" : "inactive"}
                      onChange={(event) => form.setData("is_active", event.target.value === "active")}
                      className="h-8 w-40 text-xs"
                    >
                      <option value="active">Aktif</option>
                      <option value="inactive">Nonaktif</option>
                    </Select>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {editing ? (
          <>
          <section className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-5">
              <h2 className="text-base font-semibold">Template spesifikasi produk</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Spesifikasi ini otomatis terpasang ke produk baru (atau import tanpa kolom Spesifikasi) yang memakai sub model ini. Ditambahkan hanya bila produk belum punya spesifikasi. Kosongkan untuk mematikan.
              </p>
            </div>
            <div className="p-5">
              {(form.data.templates ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada baris template. Tambahkan, mis. Material → Aluminium.</p>
              ) : null}
              <div className="space-y-2">
                {(form.data.templates ?? []).map((row, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
                    <Input
                      value={row.attribute_name}
                      onChange={(event) => updateTemplate(index, "attribute_name", event.target.value)}
                      placeholder="Nama (mis. Material)"
                      className="h-8 text-xs"
                    />
                    <Input
                      value={row.attribute_value}
                      onChange={(event) => updateTemplate(index, "attribute_value", event.target.value)}
                      placeholder="Nilai (mis. Aluminium)"
                      className="h-8 text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => form.setData("templates", (form.data.templates ?? []).filter((_, i) => i !== index))}
                    >
                      Hapus
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => form.setData("templates", [...(form.data.templates ?? []), { attribute_name: "", attribute_value: "" }])}
              >
                Tambah baris template
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-5">
              <h2 className="text-base font-semibold">Template default model</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Dipakai bila sub model tidak punya template sendiri - berlaku untuk semua produk model ini tanpa sub model tertentu. Berguna untuk nilai bersama seperti Material.
              </p>
            </div>
            <div className="p-5">
              {(form.data.model_templates ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada template default untuk model ini.</p>
              ) : null}
              <div className="space-y-2">
                {(form.data.model_templates ?? []).map((row, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
                    <Input
                      value={row.attribute_name}
                      onChange={(event) => {
                        const next = (form.data.model_templates ?? []).map((r, i) => (i === index ? { ...r, attribute_name: event.target.value } : r))
                        form.setData("model_templates", next)
                      }}
                      placeholder="Nama (mis. Material)"
                      className="h-8 text-xs"
                    />
                    <Input
                      value={row.attribute_value}
                      onChange={(event) => {
                        const next = (form.data.model_templates ?? []).map((r, i) => (i === index ? { ...r, attribute_value: event.target.value } : r))
                        form.setData("model_templates", next)
                      }}
                      placeholder="Nilai (mis. Aluminium)"
                      className="h-8 text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => form.setData("model_templates", (form.data.model_templates ?? []).filter((_, i) => i !== index))}
                    >
                      Hapus
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => form.setData("model_templates", [...(form.data.model_templates ?? []), { attribute_name: "", attribute_value: "" }])}
              >
                Tambah baris template default
              </Button>
            </div>
          </section>
          </>
        ) : null}

        
      </form>
    </AdminLayout>
  )
}
