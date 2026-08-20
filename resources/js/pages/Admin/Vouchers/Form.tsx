import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import AdminLayout from "@/layouts/admin-layout"

interface VoucherFormData {
  id?: number
  name: string
  code: string
  discount_type: "percent" | "fixed"
  discount_value: number
  min_purchase: number
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
  productOptions: TargetOption[]
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function VoucherForm({
  voucher,
  submitUrl,
  method,
  indexHref,
  targetOptions,
}: {
  voucher: VoucherFormData | null
  submitUrl: string
  method: "post" | "put"
  indexHref: string
  targetOptions: TargetOptions
}) {
  const isEdit = Boolean(voucher?.id)
  const form = useForm({
    name: voucher?.name ?? "",
    code: voucher?.code ?? "",
    discount_type: voucher?.discount_type ?? ("percent" as "percent" | "fixed"),
    discount_value: voucher?.discount_value ?? 10,
    min_purchase: voucher?.min_purchase ?? 0,
    stackable: voucher?.stackable ?? false,
    target_type: voucher?.target_type ?? ("general" as "general" | "model" | "product"),
    target_model: voucher?.target_model ?? "",
    target_product_id: voucher?.target_product_id != null ? String(voucher.target_product_id) : "",
    starts_at: toLocalInput(voucher?.starts_at),
    ends_at: toLocalInput(voucher?.ends_at),
    publish_now: voucher?.published ?? false,
  })

  const targetModelOptions = targetOptions?.modelOptions ?? []
  const targetProductOptions = targetOptions?.productOptions ?? []

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const payload = {
      ...form.data,
      starts_at: form.data.starts_at || null,
      ends_at: form.data.ends_at || null,
      target_model: form.data.target_type === "model" ? form.data.target_model : null,
      target_product_id: form.data.target_type === "product" ? form.data.target_product_id || null : null,
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
      title={isEdit ? "Edit Voucher Toko" : "Tambah Voucher Toko"}
      description="Nama internal + kode checkout. Aktifkan untuk dipakai pelanggan."
      actions={
        <Button asChild variant="secondary">
          <Link href={indexHref}>Kembali ke daftar</Link>
        </Button>
      }
    >
      <Head title={`${isEdit ? "Edit" : "Tambah"} Voucher | Admin`} />

      <form
        onSubmit={submit}
        className="mx-auto max-w-2xl space-y-6 rounded-xl border border-border bg-card p-5 shadow-sm"
      >
        <FormErrorSummary errors={form.errors} />

        <section className="space-y-4">
          <h2 className="text-base font-bold">Informasi dasar</h2>
          <Field
            id="name"
            label="Nama voucher (internal)"
            error={form.errors.name}
            hint="Tidak ditampilkan ke pembeli."
          >
            <Input
              id="name"
              value={form.data.name}
              onChange={(event) => form.setData("name", event.target.value)}
              required
            />
          </Field>
          <Field
            id="code"
            label="Kode voucher"
            error={form.errors.code}
            hint="Huruf/angka/-/_ . Pelanggan memasukkan kode ini di checkout."
          >
            <Input
              id="code"
              value={form.data.code}
              onChange={(event) => form.setData("code", event.target.value.toUpperCase())}
              className="font-mono uppercase"
              required
            />
          </Field>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-bold">Berlaku untuk</h2>
          <div className="flex flex-wrap gap-2">
            {([
              { value: "general", label: "Semua produk" },
              { value: "model", label: "Model Produk" },
              { value: "product", label: "Produk Tertentu" },
            ] as const).map((option) => (
              <label
                key={option.value}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
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
            <Field id="target_model" label="Pilih model produk" error={form.errors.target_model}>
              <Select
                id="target_model"
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
              <p className="text-xs text-muted-foreground">
                Voucher hanya berlaku untuk produk dengan model ini. Minimum pembelian dihitung dari belanja model tersebut.
              </p>
            </Field>
          ) : null}
          {form.data.target_type === "product" ? (
            <Field id="target_product_id" label="Pilih produk" error={form.errors.target_product_id}>
              <Select
                id="target_product_id"
                value={form.data.target_product_id}
                onChange={(event) => form.setData("target_product_id", event.target.value)}
              >
                <option value="">Pilih produk…</option>
                {targetProductOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Voucher hanya berlaku untuk produk ini. Minimum pembelian dihitung dari belanja produk tersebut.
              </p>
            </Field>
          ) : null}
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-bold">Waktu berlaku</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="starts_at" label="Mulai" error={form.errors.starts_at}>
              <Input
                id="starts_at"
                type="datetime-local"
                value={form.data.starts_at}
                onChange={(event) => form.setData("starts_at", event.target.value)}
              />
            </Field>
            <Field id="ends_at" label="Selesai" error={form.errors.ends_at}>
              <Input
                id="ends_at"
                type="datetime-local"
                value={form.data.ends_at}
                onChange={(event) => form.setData("ends_at", event.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-bold">Pengaturan diskon</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="discount_type" label="Jenis" error={form.errors.discount_type}>
              <Select
                id="discount_type"
                value={form.data.discount_type}
                onChange={(event) =>
                  form.setData("discount_type", event.target.value as "percent" | "fixed")
                }
              >
                <option value="percent">Persen (%)</option>
                <option value="fixed">Nominal (Rp)</option>
              </Select>
            </Field>
            <Field id="discount_value" label="Nilai diskon" error={form.errors.discount_value}>
              <Input
                id="discount_value"
                type="number"
                min={0.01}
                step="0.01"
                max={form.data.discount_type === "percent" ? 100 : undefined}
                value={form.data.discount_value}
                onChange={(event) => form.setData("discount_value", Number(event.target.value))}
                required
              />
            </Field>
          </div>
          <Field
            id="min_purchase"
            label="Minimum pembelian"
            error={form.errors.min_purchase}
            hint="Isi 0 jika tidak ada minimum."
          >
            <Input
              id="min_purchase"
              type="number"
              min={0}
              step="1"
              value={form.data.min_purchase}
              onChange={(event) => form.setData("min_purchase", Number(event.target.value))}
            />
          </Field>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-4 rounded border-border"
              checked={form.data.stackable}
              onChange={(event) => form.setData("stackable", event.target.checked)}
            />
            Boleh digabung dengan voucher lain
          </label>
          <p className="text-xs text-muted-foreground">
            Kode hanya bisa ditumpuk jika semua voucher yang dipakai mengizinkan stacking.
          </p>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-4 rounded border-border"
              checked={form.data.publish_now}
              onChange={(event) => form.setData("publish_now", event.target.checked)}
            />
            Aktifkan sekarang
          </label>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : isEdit ? "Simpan perubahan" : "Simpan voucher"}
          </Button>
          <Button asChild type="button" variant="secondary">
            <Link href={indexHref}>Batal</Link>
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
