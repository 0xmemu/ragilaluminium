import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"

interface SubsidySettings {
  enabled: boolean
  subsidy_type: "percent" | "fixed"
  subsidy_value: number
  jnt_enabled: boolean
}

export default function ShippingSubsidyEdit({
  title,
  description,
  settings,
  submitUrl,
}: {
  title: string
  description: string
  settings: SubsidySettings
  submitUrl: string
}) {
  // Nilai angka dipegang sebagai STRING agar input bebas editing (menghapus
  // "0" tidak langsung menjadi 0 lagi). Konversi Number hanya saat submit.
  const [subsidyValue, setSubsidyValue] = React.useState(String(settings.subsidy_value ?? 0))
  const [subsidyTypeError, setSubsidyTypeError] = React.useState("")

  const form = useForm({
    enabled: settings.enabled,
    subsidy_type: settings.subsidy_type,
    subsidy_value: settings.subsidy_value,
    jnt_enabled: settings.jnt_enabled,
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const numeric = Number(subsidyValue)
    if (!Number.isFinite(numeric) || numeric < 0) {
      setSubsidyTypeError("Nilai subsidi harus berupa angka 0 atau lebih.")
      return
    }
    if (form.data.subsidy_type === "percent" && numeric > 100) {
      setSubsidyTypeError("Persentase subsidi maksimal 100.")
      return
    }
    setSubsidyTypeError("")
    form.setData("subsidy_value", numeric)
    form.put(submitUrl)
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={form.data.enabled ? "active" : "inactive"} />
          <Button type="submit" form="subsidy-form" size="sm" className="h-8 px-4" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <form id="subsidy-form" onSubmit={submit} className="w-full space-y-5">
        <FormErrorSummary errors={form.errors} />

        {/* Table-first: satu baris per pengaturan */}
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Status subsidi ongkir
                </th>
                <td className="px-4 py-2.5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border"
                      checked={form.data.enabled}
                      onChange={(event) => form.setData("enabled", event.target.checked)}
                    />
                    Subsidi ongkir aktif
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aktifkan untuk memberikan potongan biaya pengiriman kepada pembeli.
                  </p>
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Skema subsidi
                </th>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Select
                      id="subsidy_type"
                      value={form.data.subsidy_type}
                      onChange={(event) =>
                        form.setData("subsidy_type", event.target.value as "percent" | "fixed")
                      }
                      className="h-8 w-56 text-xs"
                    >
                      <option value="percent">Persentase dari ongkir (%)</option>
                      <option value="fixed">Nominal tetap (Rp)</option>
                    </Select>
                    <Input
                      id="subsidy_value"
                      type="number"
                      min={0}
                      step="0.01"
                      max={form.data.subsidy_type === "percent" ? 100 : undefined}
                      value={subsidyValue}
                      onChange={(event) => {
                        setSubsidyValue(event.target.value)
                        setSubsidyTypeError("")
                      }}
                      className={`h-8 w-32 text-xs ${subsidyTypeError ? "border-destructive" : ""}`}
                      required
                    />
                  </div>
                  {subsidyTypeError ? (
                    <p className="mt-1 text-xs text-destructive">{subsidyTypeError}</p>
                  ) : null}
                  {form.errors.subsidy_value ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.subsidy_value}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.data.subsidy_type === "percent" ? "Nilai persentase" : "Nilai nominal"}
                  </p>
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Kurir terhubung
                </th>
                <td className="px-4 py-2.5">
                  <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 rounded border-border"
                      checked={form.data.jnt_enabled}
                      onChange={(event) => form.setData("jnt_enabled", event.target.checked)}
                    />
                    <span>
                      J&T Cargo
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        Skema subsidi menggunakan aturan kurir tersimpan. Hanya kurir yang dicentang yang mendapat subsidi.
                      </span>
                    </span>
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