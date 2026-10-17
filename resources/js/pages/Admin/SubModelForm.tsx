import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { Field, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { SearchSelect } from "@/components/admin/ui/search-select"

import AdminLayout from "@/layouts/admin-layout"
import { SubmitGateButton } from "@/components/admin/ui/submit-gate-button"
import { jagaGerbang } from "@/lib/submit-gate"

interface TemplateRow {
  attribute_name: string
  attribute_value: string
}

interface SubModelData {
  id?: number
  product_model: string
  code: string
  name: string
  is_active: boolean
  templates?: TemplateRow[]
  model_templates?: TemplateRow[]
}

function toSubModelCode(text: string): string {
  return text
    .toUpperCase()
    .replace(/[-\s]+/g, "_")
    .replace(/[^A-Z0-9_]/g, "")
}

export default function SubModelForm({
  title,
  subModel,
  attributeTemplates = [],
  modelTemplates = [],
  modelOptions,
  submitUrl,
  indexUrl,
  backUrl,
}: {
  title: string
  subModel: SubModelData | null
  attributeTemplates?: Array<TemplateRow & { id?: number }>
  modelTemplates?: Array<TemplateRow & { id?: number }>
  modelOptions: Array<{ value: string; label: string }>
  submitUrl: string
  indexUrl: string
  backUrl?: string | null
}) {
  const editing = Boolean(subModel)
  const [codeManuallyEdited, setCodeManuallyEdited] = React.useState(false)
  const form = useForm<SubModelData>({
    product_model: subModel?.product_model ?? "",
    code: subModel?.code ?? "",
    name: subModel?.name ?? "",
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

  // Gerbang isi (kontrak "logika tombol"): kolom wajibnya mengikuti aturan
  // `required` SubModelController. Kolom Kode SENGAJA tidak ikut dikunci, karena
  // controller mengisinya otomatis dari nama sebelum validasi (store() melakukan
  // Str::slug dari name), jadi mengunci tombolnya saat kode kosong akan menahan
  // simpan yang sebenarnya diterima server.
  const gerbang = {
    fields: {
      product_model: "Model produk",
      name: "Nama sub model",
    },
    requireChange: editing,
  }

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
          <SubmitGateButton
            form={form} {...gerbang}
            formId="sub-model-form"
            label={editing ? "Simpan" : "Tambah"}
            processing={form.processing}
          />
        </div>
      }
    >
      <Head title={title} />
      <form id="sub-model-form" onSubmit={jagaGerbang(gerbang, form, submit)} className="w-full space-y-5">
        <FormErrorSummary errors={form.errors} />

        <SectionCard
          title="Identitas sub model"
          description="Model induk, nama tampilan, dan kode yang dipakai di URL serta data produk."
        >
          <FieldGrid>
            <Field
              id="sub-model-product-model"
              label="Model produk"
              required
              error={form.errors.product_model}
              hint="Sub model selalu menempel pada satu model induk."
            >
              {/* Pemilih bercari (kontrak 2026-09-16): form tambah selalu
                  kosong, admin mencari & memilih model sendiri. */}
              <SearchSelect
                id="sub-model-product-model"
                options={modelOptions}
                value={form.data.product_model}
                onValueChange={(value) => form.setData("product_model", value)}
                placeholder="Pilih model"
                searchPlaceholder="Cari model"
                emptyMessage="Model tidak ditemukan."
                error={form.errors.product_model}
              />
            </Field>

            <Field
              id="sub-model-name"
              label="Nama sub model"
              required
              error={form.errors.name}
              hint="Nama yang tampil ke pembeli, misalnya Jalusi."
            >
              <Input
                value={form.data.name}
                onChange={(event) => {
                  const newName = event.target.value
                  form.setData((prev) => ({
                    ...prev,
                    name: newName,
                    ...(!editing && !codeManuallyEdited ? { code: toSubModelCode(newName) } : {}),
                  }))
                }}
                placeholder="Contoh: Jalusi"
              />
            </Field>

            <Field
              id="sub-model-code"
              label={editing ? "Kode" : "Kode (opsional)"}
              error={form.errors.code}
              hint={
                editing
                  ? "Kode tidak bisa diubah setelah dibuat."
                  : "Dibuat otomatis dari nama jika dikosongkan."
              }
            >
              <Input
                value={form.data.code}
                onChange={(event) => {
                  const val = event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "")
                  setCodeManuallyEdited(val.trim() !== "")
                  form.setData("code", val)
                }}
                placeholder={editing ? "" : "Otomatis dari nama"}
                className="font-mono"
                disabled={editing}
              />
            </Field>

            {editing ? (
              <Field id="sub-model-status" label="Status">
                <Select
                  value={form.data.is_active ? "active" : "inactive"}
                  onChange={(event) => form.setData("is_active", event.target.value === "active")}
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </Select>
              </Field>
            ) : null}
          </FieldGrid>
        </SectionCard>

        {editing ? (
          <>
          <SectionCard
          title="Template spesifikasi produk"
          description="Spesifikasi ini otomatis terpasang ke produk baru (atau import tanpa kolom Spesifikasi) yang memakai sub model ini. Ditambahkan hanya bila produk belum punya spesifikasi. Kosongkan untuk mematikan."
        >
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
                Tambah
              </Button>
          </SectionCard>

          <SectionCard
          title="Template default model"
          description="Dipakai bila sub model tidak punya template sendiri - berlaku untuk semua produk model ini tanpa sub model tertentu. Berguna untuk nilai bersama seperti Material."
        >
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
                Tambah
              </Button>
          </SectionCard>
          </>
        ) : null}

        
      </form>
    </AdminLayout>
  )
}
