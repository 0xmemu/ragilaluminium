import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { FormErrorSummary } from "@/components/admin/ui/field"
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

function nowLocalInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function addHoursLocalInput(base: string | null | undefined, hours: number): string {
  const date = base ? new Date(base) : new Date()
  if (Number.isNaN(date.getTime())) return ""
  const target = new Date(date.getTime() + hours * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`
}

export default function VoucherForm({
  voucher,
  submitUrl,
  method,
  indexHref,
  targetOptions,
  backUrl
}: {
  backUrl?: string | null
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
      backUrl={backUrl}
      title={isEdit ? "Edit Voucher Toko" : "Tambah Voucher Toko"}
      description="Nama internal + kode checkout. Aktifkan untuk dipakai pelanggan."
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={indexHref}>Batal</Link>
          </Button>
          <Button type="submit" form="voucher-form" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
          </Button>
        </div>
      }
    >
      <Head title={`${isEdit ? "Edit" : "Tambah"} Voucher | Admin`} />

      <form id="voucher-form" onSubmit={submit} className="w-full space-y-5">
        <FormErrorSummary errors={form.errors} />

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Nama voucher (internal) <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    value={form.data.name}
                    onChange={(event) => form.setData("name", event.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                  {form.errors.name ? <p className="mt-1 text-xs text-destructive">{form.errors.name}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">Tidak ditampilkan ke pembeli.</p>
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Kode voucher <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    value={form.data.code}
                    onChange={(event) => form.setData("code", event.target.value.toUpperCase())}
                    className="h-8 w-56 text-xs font-mono uppercase"
                    required
                  />
                  {form.errors.code ? <p className="mt-1 text-xs text-destructive">{form.errors.code}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">Huruf/angka/-/_ . Pelanggan memasukkan kode ini di checkout.</p>
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Diskon
                </th>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Select
                      value={form.data.discount_type}
                      onChange={(event) => form.setData("discount_type", event.target.value as "percent" | "fixed")}
                      className="h-8 w-48 text-xs"
                    >
                      <option value="percent">Persentase (%)</option>
                      <option value="fixed">Nominal tetap (Rp)</option>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.data.discount_value}
                      onChange={(event) => form.setData("discount_value", Number(event.target.value))}
                      className="h-8 w-32 text-xs"
                      required
                    />
                  </div>
                  {form.errors.discount_value ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.discount_value}</p>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Minimum pembelian
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    value={form.data.min_purchase}
                    onChange={(event) => form.setData("min_purchase", Number(event.target.value))}
                    className="h-8 w-44 text-xs"
                  />
                  {form.errors.min_purchase ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.min_purchase}</p>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Tumpuk (stackable)</th>
                <td className="px-4 py-2.5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border"
                      checked={form.data.stackable}
                      onChange={(event) => form.setData("stackable", event.target.checked)}
                    />
                    Bisa ditumpuk dengan voucher lain
                  </label>
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Berlaku untuk
                </th>
                <td className="px-4 py-2.5">
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
                    <div className="mt-3">
                      <Select
                        value={form.data.target_model}
                        onChange={(event) => form.setData("target_model", event.target.value)}
                        className="h-8 w-full text-xs"
                      >
                        <option value="">Pilih model…</option>
                        {targetModelOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                      {form.errors.target_model ? (
                        <p className="mt-1 text-xs text-destructive">{form.errors.target_model}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Voucher hanya berlaku untuk produk dengan model ini. Minimum pembelian dihitung dari belanja model tersebut.
                      </p>
                    </div>
                  ) : null}
                  {form.data.target_type === "product" ? (
                    <div className="mt-3">
                      <Select
                        value={form.data.target_product_id}
                        onChange={(event) => form.setData("target_product_id", event.target.value)}
                        className="h-8 w-full text-xs"
                      >
                        <option value="">Pilih produk…</option>
                        {targetProductOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                      {form.errors.target_product_id ? (
                        <p className="mt-1 text-xs text-destructive">{form.errors.target_product_id}</p>
                      ) : null}
                    </div>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Periode berlaku
                </th>
                <td className="px-4 py-2.5">
                  <div className="max-w-lg space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
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
                      <span className="text-[11px] text-muted-foreground">
                        Atau atur tanggal dan jam mulai secara kustom di bawah
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="starts_at" className="mb-1 block text-[10px] font-semibold tracking-wide text-muted-foreground">Mulai</label>
                        <Input
                          id="starts_at"
                          type="datetime-local"
                          value={form.data.starts_at ?? ""}
                          onChange={(event) => form.setData("starts_at", event.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor="ends_at" className="mb-1 block text-[10px] font-semibold tracking-wide text-muted-foreground">Selesai (Kustom)</label>
                        <Input
                          id="ends_at"
                          type="datetime-local"
                          value={form.data.ends_at ?? ""}
                          onChange={(event) => form.setData("ends_at", event.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
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
                      {form.data.ends_at && (
                        <button
                          type="button"
                          onClick={() => form.setData("ends_at", "")}
                          className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                        >
                          Kosongkan
                        </button>
                      )}
                    </div>

                    {form.errors.starts_at ? (
                      <p className="mt-1 text-xs text-destructive">{form.errors.starts_at}</p>
                    ) : null}
                    {form.errors.ends_at ? (
                      <p className="mt-1 text-xs text-destructive">{form.errors.ends_at}</p>
                    ) : null}
                  </div>
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Publikasi</th>
                <td className="px-4 py-2.5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border"
                      checked={form.data.publish_now}
                      onChange={(event) => form.setData("publish_now", event.target.checked)}
                    />
                    Langsung aktifkan setelah disimpan
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
        </div>


      </form>
    </AdminLayout>
  )
}