import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { CheckboxField, Field, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import type { PickerProduct } from "@/components/admin/ui/ProductPicker"
import { ProductPickerSheet } from "@/components/admin/product-picker-sheet"
import { Select } from "@/components/admin/ui/select"
import AdminLayout from "@/layouts/admin-layout"
import { addHoursLocalInput, nowLocalInput, toLocalInput } from "@/lib/period"
import { SubmitGateButton } from "@/components/admin/ui/submit-gate-button"

interface VoucherFormData {
  id?: number
  name: string
  code: string
  discount_type: "percent" | "fixed"
  discount_value: string
  min_purchase: string
  stackable: boolean
  target_type: "general" | "model" | "product"
  target_model: string
  target_product_id: string
  starts_at: string | null
  ends_at: string | null
  published: boolean
}

interface TargetOption {
  value: string
  label: string
  model?: string
}

interface TargetOptions {
  modelOptions: TargetOption[]
}

export default function VoucherForm({
  voucher,
  submitUrl,
  method,
  indexHref,
  targetOptions,
  initialProduct,
  backUrl
}: {
  backUrl?: string | null
  voucher: VoucherFormData | null
  submitUrl: string
  method: "post" | "put"
  indexHref: string
  targetOptions: TargetOptions
  initialProduct: PickerProduct | null
}) {
  const isEdit = Boolean(voucher?.id)
  const form = useForm({
    name: voucher?.name ?? "",
    code: voucher?.code ?? "",
    discount_type: voucher?.discount_type ?? ("percent" as "percent" | "fixed"),
    discount_value: voucher?.discount_value != null ? String(voucher.discount_value) : "10",
    min_purchase: voucher?.min_purchase ? String(voucher.min_purchase) : "",
    stackable: voucher?.stackable ?? false,
    target_type: voucher?.target_type ?? ("general" as "general" | "model" | "product"),
    target_model: voucher?.target_model ?? "",
    target_product_id: voucher?.target_product_id != null ? String(voucher.target_product_id) : "",
    starts_at: toLocalInput(voucher?.starts_at),
    ends_at: toLocalInput(voucher?.ends_at),
    publish_now: voucher?.published ?? false,
  })

  const targetModelOptions = targetOptions?.modelOptions ?? []
  // Satu voucher menyasar satu produk, dan pemilihannya memakai ProductPicker
  // yang sama dengan halaman admin lain, bukan dropdown bawaan halaman.
  const [produkPicked, setProdukPicked] = React.useState<PickerProduct | null>(initialProduct)

  /**
   * Kirim form. `activate` = niat tombol yang ditekan (model form Promo Toko:
   * memilih keaktifan lewat tombol, bukan checkbox "Publikasi" di dalam form).
   * Data lewat form.transform(); argumen kedua form.post/put adalah options
   * sehingga payload di sana diabaikan Inertia.
   */
  function submitWith(activate: boolean) {
    form.transform((data) => ({
      ...data,
      starts_at: form.data.starts_at || null,
      ends_at: form.data.ends_at || null,
      discount_value: form.data.discount_value === "" ? null : Number(form.data.discount_value),
      min_purchase: form.data.min_purchase === "" ? null : Number(form.data.min_purchase),
      target_model: form.data.target_type === "model" ? form.data.target_model : null,
      target_product_id: form.data.target_type === "product" ? form.data.target_product_id || null : null,
      publish_now: activate,
    }))
    if (method === "post") {
      form.post(submitUrl)
      return
    }
    form.put(submitUrl)
  }

  // Gerbang isi tombol simpan: kolom wajibnya mengikuti aturan `required`
  // controller, jadi frontend tidak menciptakan aturan baru.
  const gerbang = {
    fields: {
      name: "Nama voucher",
      code: "Kode voucher",
      discount_type: "Jenis diskon",
      discount_value: "Nilai diskon",
    },
    requireChange: isEdit,
  }

  return (
    <AdminLayout
      backUrl={backUrl}
      title={isEdit ? "Edit Voucher Toko" : "Tambah Voucher Toko"}
      description={
        isEdit
          ? "Perubahan berlaku setelah disimpan."
          : "Aktifkan langsung saat menyimpan, atau simpan dulu tanpa mengaktifkan."
      }
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={indexHref}>Batal</Link>
          </Button>
          {isEdit ? (
            <SubmitGateButton
              type="button"
              onClick={() => submitWith(false)}
              form={form}
              {...gerbang}
            >
              Simpan
            </SubmitGateButton>
          ) : (
            <>
              <SubmitGateButton
                type="button"
                variant="secondary"
                onClick={() => submitWith(false)}
                form={form}
                {...gerbang}
              >
                Simpan tanpa aktifkan
              </SubmitGateButton>
              <SubmitGateButton
                type="button"
                onClick={() => submitWith(true)}
                form={form}
                {...gerbang}
              >
                Simpan &amp; Aktifkan
              </SubmitGateButton>
            </>
          )}
        </div>
      }
    >
      <Head title={`${isEdit ? "Edit" : "Tambah"} Voucher | Admin`} />

      <form id="voucher-form" onSubmit={(event) => event.preventDefault()} className="w-full space-y-5">
        <FormErrorSummary errors={form.errors} />

        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-bold">Informasi voucher</h2>
          <FieldGrid>
            <Field id="voucher-name" label="Nama voucher (internal)" required error={form.errors.name} hint="Tidak ditampilkan ke pembeli." className="sm:col-span-2">
              <Input
                value={form.data.name}
                onChange={(event) => form.setData("name", event.target.value)}
                required
              />
            </Field>
            <Field id="voucher-code" label="Kode voucher" required error={form.errors.code} hint="Huruf, angka, tanda hubung, atau garis bawah. Pelanggan memasukkan kode ini di checkout.">
              <Input
                value={form.data.code}
                onChange={(event) => form.setData("code", event.target.value.toUpperCase())}
                className="font-mono uppercase"
                required
              />
            </Field>
            <Field id="voucher-discount" label="Diskon" required error={form.errors.discount_value}>
              <div className="flex items-center gap-2">
                <Select
                  value={form.data.discount_type}
                  onChange={(event) => form.setData("discount_type", event.target.value as "percent" | "fixed")}
                  className="w-44"
                >
                  <option value="percent">Persentase (%)</option>
                  <option value="fixed">Nominal tetap (Rp)</option>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.data.discount_value}
                  onChange={(event) => form.setData("discount_value", event.target.value)}
                  className="w-32"
                  required
                />
              </div>
            </Field>
            <Field id="voucher-min-purchase" label="Minimum pembelian" error={form.errors.min_purchase}>
              <Input
                type="number"
                min={0}
                step="1"
                value={form.data.min_purchase}
                onChange={(event) => form.setData("min_purchase", event.target.value)}
              />
            </Field>
            <Field id="voucher-stackable" label="Tumpuk (stackable)">
              <CheckboxField
                id="voucher-stackable"
                checked={form.data.stackable}
                onChange={(checked) => form.setData("stackable", checked)}
                label="Bisa ditumpuk dengan voucher lain"
                standalone
              />
            </Field>
          </FieldGrid>
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-bold">Berlaku untuk</h2>
          <p className="text-sm text-muted-foreground">
            Pilih cakupan voucher: semua produk, satu model, atau satu produk tertentu.
          </p>
          <div className="flex flex-wrap gap-2">
            {([
              { value: "general", label: "Semua produk" },
              { value: "model", label: "Model Produk" },
              { value: "product", label: "Produk Tertentu" },
            ] as const).map((option) => (
              <label
                key={option.value}
                className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-semibold ${
                  form.data.target_type === option.value
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="target_type"
                  className="size-4 accent-primary"
                  checked={form.data.target_type === option.value}
                  onChange={() => form.setData("target_type", option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
          {form.data.target_type === "model" ? (
            <Field id="voucher-target-model" label="Model" error={form.errors.target_model} hint="Voucher hanya berlaku untuk produk dengan model ini. Minimum pembelian dihitung dari belanja model tersebut." className="sm:col-span-2">
              <Select
                value={form.data.target_model}
                onChange={(event) => form.setData("target_model", event.target.value)}
              >
                <option value="">Pilih model…</option>
                {targetModelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {form.data.target_type === "product" ? (
            <div className="grid gap-2">
              <ProductPickerSheet
                title="Pilih produk voucher"
                description="Voucher hanya berlaku untuk produk yang dipilih di sini; satu voucher menyasar satu produk."
                maxSelection={1}
                initialSelection={produkPicked ? [produkPicked] : []}
                onSelect={(products) => {
                  const produk = products[0] ?? null
                  setProdukPicked(produk)
                  form.setData("target_product_id", produk ? String(produk.id) : "")
                }}
                trigger={(open) => (
                  <Button
                    type="button"
                    variant={produkPicked ? "outline" : "secondary"}
                    size="sm"
                    onClick={open}
                    className="w-fit max-w-full"
                  >
                    {produkPicked ? (
                      <>
                        <span className="min-w-0 truncate">{produkPicked.name}</span>
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                          {produkPicked.parent_sku}
                        </span>
                      </>
                    ) : (
                      "Pilih produk"
                    )}
                  </Button>
                )}
              />
              {produkPicked ? (
                <button
                  type="button"
                  onClick={() => {
                    setProdukPicked(null)
                    form.setData("target_product_id", "")
                  }}
                  className="w-fit text-xs text-muted-foreground transition hover:text-foreground"
                >
                  Kosongkan pilihan produk
                </button>
              ) : null}
              {form.errors.target_product_id ? (
                <p className="text-xs text-destructive">{form.errors.target_product_id}</p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <h2 className="text-base font-bold">Periode berlaku</h2>
              <p className="text-xs text-muted-foreground">
                Tentukan waktu mulai voucher dan batas waktu berakhir.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const now = nowLocalInput()
                form.setData("starts_at", now)
                if (!form.data.ends_at) {
                  form.setData("ends_at", addHoursLocalInput(now, 24 * 7))
                }
              }}
              className="rounded border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Mulai Sekarang
            </button>
          </div>
          <FieldGrid>
            <Field id="starts_at" label="Mulai" error={form.errors.starts_at}>
              <Input
                type="datetime-local"
                value={form.data.starts_at}
                onChange={(event) => form.setData("starts_at", event.target.value)}
              />
            </Field>
            <Field id="ends_at" label="Selesai" error={form.errors.ends_at}>
              <Input
                type="datetime-local"
                value={form.data.ends_at}
                onChange={(event) => form.setData("ends_at", event.target.value)}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:col-span-2">
              <span className="text-muted-foreground">Preset durasi:</span>
              {[
                { label: "+24 Jam", hours: 24 },
                { label: "+3 Hari", hours: 72 },
                { label: "+7 Hari", hours: 168 },
                { label: "+30 Hari", hours: 720 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    const base = form.data.starts_at || nowLocalInput()
                    form.setData("ends_at", addHoursLocalInput(base, preset.hours))
                  }}
                  className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground transition-colors hover:bg-muted"
                >
                  {preset.label}
                </button>
              ))}
              {form.data.ends_at ? (
                <button
                  type="button"
                  onClick={() => form.setData("ends_at", "")}
                  className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                >
                  Kosongkan
                </button>
              ) : null}
            </div>
          </FieldGrid>
        </section>
      </form>

</AdminLayout>
  )
}