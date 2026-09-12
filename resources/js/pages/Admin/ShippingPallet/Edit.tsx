import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import AdminLayout from "@/layouts/admin-layout"

export default function ShippingPalletEdit({
  title,
  description,
  settings,
  submitUrl,
}: {
  title: string
  description: string
  settings: { allowance_per_side_cm: number }
  submitUrl: string
}) {
  const [value, setValue] = React.useState(String(settings.allowance_per_side_cm ?? 3))
  const form = useForm({ allowance_per_side_cm: settings.allowance_per_side_cm })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric < 0) return
    form.setData("allowance_per_side_cm", numeric)
    form.put(submitUrl)
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <Button type="submit" form="pallet-form" disabled={form.processing}>
          {form.processing ? "Menyimpan..." : "Simpan"}
        </Button>
      }
    >
      <Head title={`${title} | Admin`} />
      <form id="pallet-form" onSubmit={submit} className="w-full space-y-5">
        <FormErrorSummary errors={form.errors} />
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Allowance per sisi (cm)
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    className="h-8 w-32 text-xs"
                    required
                  />
                  {form.errors.allowance_per_side_cm ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.allowance_per_side_cm}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dimensi luar produk = dimensi dalam + (2 × allowance). Nilai per produk di form edit produk menimpa pengaturan ini. Default 3 cm.
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </form>
    </AdminLayout>
  )
}
