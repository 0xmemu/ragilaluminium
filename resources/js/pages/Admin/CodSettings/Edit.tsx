import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"

interface CodSettingsData {
  enabled: boolean
  fee_type: "percent"
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
    // String state supaya input bisa dikosongkan (Number("")=0 membuat "0" menempel).
    fee_value: String(settings.fee_value ?? 0),
    max_order_amount: settings.max_order_amount ?? "",
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.transform((data) => ({
        ...data,
        fee_value: data.fee_value === "" || data.fee_value === null
          ? 0
          : Number(data.fee_value),
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

      <form onSubmit={submit} className="w-full space-y-5">
        <FormErrorSummary errors={form.errors} />

        {/* Table-first: satu baris per pengaturan */}
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Status layanan COD
                </th>
                <td className="px-4 py-2.5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border"
                      checked={form.data.enabled}
                      onChange={(event) => form.setData("enabled", event.target.checked)}
                    />
                    Layanan COD aktif
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aktifkan atau nonaktifkan Bayar di Tempat untuk seluruh pelanggan.
                  </p>
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Biaya penanganan (handling fee)
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    id="fee_value"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.data.fee_value}
                    onChange={(event) => form.setData("fee_value", event.target.value)}
                    className="h-8 w-44 text-xs"
                    required
                  />
                  {form.errors.fee_value ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.fee_value}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nilai biaya (%). Ditambahkan ke total tagihan saat pelanggan memilih COD - dihitung dari subtotal setelah voucher.
                  </p>
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Limit transaksi
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    id="max_order_amount"
                    type="number"
                    min={0}
                    step="1"
                    value={form.data.max_order_amount}
                    onChange={(event) => form.setData("max_order_amount", event.target.value)}
                    className="h-8 w-44 text-xs"
                    placeholder="Contoh: 5000000"
                  />
                  {form.errors.max_order_amount ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.max_order_amount}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Maksimal nilai belanja (opsional). Kosongkan atau 0 = tanpa batas. Di luar batas, COD disembunyikan di checkout.
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

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