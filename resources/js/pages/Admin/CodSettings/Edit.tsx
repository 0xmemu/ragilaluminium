import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"

interface CodSettingsData {
  enabled: boolean
  fee_type: "percent" | "fixed"
  fee_value: number
  max_order_amount: number | null
}

export default function CodSettingsEdit({
  title,
  description,
  settings,
  submitUrl,
}: {
  title: string
  description: string
  settings: CodSettingsData
  submitUrl: string
}) {
  const form = useForm({
    enabled: settings.enabled,
    fee_type: settings.fee_type,
    fee_value: settings.fee_value,
    max_order_amount: settings.max_order_amount ?? "",
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.transform((data) => ({
        ...data,
        max_order_amount:
          data.max_order_amount === "" || data.max_order_amount === null
            ? null
            : Number(data.max_order_amount),
      }))
    form.put(submitUrl)
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={<StatusBadge status={form.data.enabled ? "active" : "inactive"} />}
    >
      <Head title={`${title} | Admin`} />

      <form
        onSubmit={submit}
        className="mx-auto max-w-2xl space-y-6 rounded-xl border border-border bg-card p-5 shadow-sm"
      >
        <FormErrorSummary errors={form.errors} />

        <section className="space-y-3">
          <h2 className="text-base font-bold">Status layanan COD</h2>
          <p className="text-sm text-muted-foreground">
            Aktifkan atau nonaktifkan Bayar di Tempat untuk seluruh pelanggan.
          </p>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-4 rounded border-border"
              checked={form.data.enabled}
              onChange={(event) => form.setData("enabled", event.target.checked)}
            />
            Layanan COD aktif
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-bold">Biaya penanganan (handling fee)</h2>
          <p className="text-sm text-muted-foreground">
            Ditambahkan ke total tagihan saat pelanggan memilih COD. Dihitung dari subtotal setelah voucher.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="fee_type" label="Jenis biaya" error={form.errors.fee_type}>
              <Select
                id="fee_type"
                value={form.data.fee_type}
                onChange={(event) =>
                  form.setData("fee_type", event.target.value as "percent" | "fixed")
                }
              >
                <option value="percent">Persentase (%)</option>
                <option value="fixed">Nominal tetap (Rp)</option>
              </Select>
            </Field>
            <Field
              id="fee_value"
              label={form.data.fee_type === "percent" ? "Nilai biaya (%)" : "Nilai biaya (Rp)"}
              error={form.errors.fee_value}
            >
              <Input
                id="fee_value"
                type="number"
                min={0}
                step="0.01"
                max={form.data.fee_type === "percent" ? 100 : undefined}
                value={form.data.fee_value}
                onChange={(event) => form.setData("fee_value", Number(event.target.value))}
                required
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-bold">Limit transaksi</h2>
          <Field
            id="max_order_amount"
            label="Maksimal nilai belanja (opsional)"
            error={form.errors.max_order_amount}
            hint="Kosongkan atau 0 = tanpa batas. Di luar batas, COD disembunyikan di checkout."
          >
            <Input
              id="max_order_amount"
              type="number"
              min={0}
              step="1"
              value={form.data.max_order_amount}
              onChange={(event) => form.setData("max_order_amount", event.target.value)}
              placeholder="Contoh: 5000000"
            />
          </Field>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan perubahan"}
          </Button>
          <Button asChild type="button" variant="secondary">
            <Link href="/admin/vouchers">Ke Voucher Toko</Link>
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
