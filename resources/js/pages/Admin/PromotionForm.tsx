import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { Switch } from "@/components/admin/ui/switch"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"

interface TargetDraft {
  target_type: "model" | "sub_model" | "product"
  target_id: string
  excluded: boolean
  override_discount_percent: string
}

interface Option {
  value: string
  label: string
  model?: string
}

interface PromotionFormData {
  id?: number
  type: string
  name: string
  discount_percent: number
  starts_at: string
  ends_at: string
  sync_banner: boolean
  targets: TargetDraft[]
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function PromotionForm({
  title,
  promotion,
  submitUrl,
  indexUrl,
  options,
}: {
  title: string
  promotion: PromotionFormData | null
  submitUrl: string
  indexUrl: string
  options: {
    type: string
    modelOptions: Array<{ value: string; label: string }>
    subModelOptions: Option[]
    productOptions: Option[]
  }
}) {
  const editing = Boolean(promotion?.id)
  const form = useForm<PromotionFormData>({
    type: promotion?.type ?? options.type,
    name: promotion?.name ?? "",
    discount_percent: promotion?.discount_percent ?? 10,
    starts_at: toLocalInput(promotion?.starts_at),
    ends_at: toLocalInput(promotion?.ends_at),
    sync_banner: promotion?.sync_banner ?? false,
    targets: promotion?.targets?.map((target) => ({
      target_type: target.target_type,
      target_id: String(target.target_id),
      excluded: Boolean(target.excluded),
      override_discount_percent: target.override_discount_percent ? String(target.override_discount_percent) : "",
    })) ?? [],
  })
  const [productSearch, setProductSearch] = React.useState("")
  const [excludeSearch, setExcludeSearch] = React.useState("")

  function addTarget(target_type: TargetDraft["target_type"], value: string) {
    if (!value) return
    if (form.data.targets.some((t) => t.target_type === target_type && t.target_id === value && !t.excluded)) return
    form.setData("targets", [
      ...form.data.targets,
      { target_type, target_id: value, excluded: false, override_discount_percent: "" },
    ])
  }

  function addExcluded(value: string) {
    if (!value) return
    if (form.data.targets.some((t) => t.target_type === "product" && t.target_id === value && t.excluded)) return
    form.setData("targets", [
      ...form.data.targets,
      { target_type: "product", target_id: value, excluded: true, override_discount_percent: "" },
    ])
  }

  function removeTarget(index: number) {
    form.setData("targets", form.data.targets.filter((_, i) => i !== index))
  }

  function setOverride(index: number, value: string) {
    form.setData("targets", form.data.targets.map((target, i) => (i === index ? { ...target, override_discount_percent: value } : target)))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const payload = {
      ...form.data,
      starts_at: form.data.starts_at || null,
      ends_at: form.data.ends_at || null,
    }
    if (editing) {
      form.put(submitUrl, { ...payload, onError: () => undefined } as never)
    } else {
      form.post(submitUrl, payload as never)
    }
  }

  const included = form.data.targets.filter((t) => !t.excluded)
  const excluded = form.data.targets.filter((t) => t.excluded)
  const filteredProducts = options.productOptions.filter((option) => option.label.toLowerCase().includes(productSearch.toLowerCase()))
  const filteredExclude = options.productOptions.filter((option) => option.label.toLowerCase().includes(excludeSearch.toLowerCase()))

  return (
    <AdminLayout title={title} description={editing ? "Perubahan berlaku setelah disimpan; kampanye draft baru dapat diaktifkan dari daftar." : "Kampanye dibuat sebagai draft, lalu diaktifkan dari daftar."}>
      <Head title={title} />
      <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6">
        <FormErrorSummary errors={form.errors} />

        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <h2 className="text-base font-bold">Informasi kampanye</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="promotion-name" label="Nama kampanye" required error={form.errors.name} className="sm:col-span-2">
              <Input value={form.data.name} onChange={(event) => form.setData("name", event.target.value)} placeholder={form.data.type === "flash_sale" ? "contoh: Flash Sale 8.8" : "contoh: Promo Akhir Tahun"} />
            </Field>
            <Field id="promotion-discount" label="Diskon (%)" required error={form.errors.discount_percent}>
              <Input type="number" min="1" max="90" value={form.data.discount_percent} onChange={(event) => form.setData("discount_percent", Number(event.target.value))} />
            </Field>
            <Field id="promotion-banner" label="Sinkron ke banner beranda">
              <div className="flex h-10 items-center">
                <Switch label="Sinkron ke banner beranda" checked={form.data.sync_banner} onCheckedChange={(checked) => form.setData("sync_banner", checked)} />
                <span className="ml-3 text-sm text-muted-foreground">Tampilkan badge/baris kampanye di beranda</span>
              </div>
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <h2 className="text-base font-bold">Waktu berlaku</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="promotion-starts" label="Mulai" error={form.errors.starts_at}>
              <Input type="datetime-local" value={form.data.starts_at} onChange={(event) => form.setData("starts_at", event.target.value)} />
            </Field>
            <Field id="promotion-ends" label="Selesai" error={form.errors.ends_at}>
              <Input type="datetime-local" value={form.data.ends_at} onChange={(event) => form.setData("ends_at", event.target.value)} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Kosongkan periode = berlaku terus (dibatasi aturan: hanya 1 Promo Toko aktif & 1 Flash Sale aktif).
          </p>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <h2 className="text-base font-bold">Target produk</h2>
          <p className="text-sm text-muted-foreground">
            Pilih model, sub model, atau produk tertentu. Produk yang dikecualikan tidak kena diskon meski masuk target model/sub model.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="promotion-model" label="Seluruh produk model">
              <Select value="" onChange={(event) => addTarget("model", event.target.value)}>
                <option value="">— pilih model —</option>
                {options.modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Field id="promotion-submodel" label="Sub model">
              <Select value="" onChange={(event) => addTarget("sub_model", event.target.value)}>
                <option value="">— pilih sub model —</option>
                {options.subModelOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="promotion-product" label="Produk tertentu">
              <Input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Cari nama/SKU…" />
              <Select value="" onChange={(event) => addTarget("product", event.target.value)}>
                <option value="">— pilih produk —</option>
                {filteredProducts.slice(0, 50).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Field id="promotion-exclude" label="Kecualikan produk">
              <Input value={excludeSearch} onChange={(event) => setExcludeSearch(event.target.value)} placeholder="Cari nama/SKU…" />
              <Select value="" onChange={(event) => addExcluded(event.target.value)}>
                <option value="">— pilih produk —</option>
                {filteredExclude.slice(0, 50).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="space-y-2">
            {included.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada target dipilih.</p>
            ) : (
              included.map((target, index) => {
                const option = [...options.modelOptions, ...options.subModelOptions, ...options.productOptions].find((o) => o.value === target.target_id)
                return (
                  <div key={`${target.target_type}-${target.target_id}`} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <span className="flex-1 truncate">{option?.label ?? target.target_id}</span>
                    <Field id={`override-${index}`} label="Diskon khusus %" className="w-40">
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        value={target.override_discount_percent}
                        onChange={(event) => setOverride(index, event.target.value)}
                        placeholder={`global ${form.data.discount_percent}%`}
                      />
                    </Field>
                    <button type="button" className={cn("shrink-0 text-destructive")} onClick={() => removeTarget(index)}>
                      Hapus
                    </button>
                  </div>
                )
              })
            )}
            {excluded.map((target, index) => {
              const option = options.productOptions.find((o) => o.value === target.target_id)
              return (
                <div key={`excluded-${target.target_id}`} className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                  <span className="flex-1 truncate line-through text-destructive">{option?.label ?? target.target_id}</span>
                  <button type="button" className="shrink-0 text-destructive" onClick={() => removeTarget(index + included.length)}>
                    Hapus
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        <div className="flex flex-wrap justify-between gap-3">
          <Button asChild variant="secondary">
            <Link href={indexUrl}>Batal</Link>
          </Button>
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan…" : editing ? "Simpan perubahan" : "Simpan sebagai draft"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
