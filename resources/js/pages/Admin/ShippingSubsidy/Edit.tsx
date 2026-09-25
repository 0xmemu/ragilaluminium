import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { CheckboxField, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"

interface SubsidySettings {
  enabled: boolean
  /** Persentase dari tarif kurir. Skema lain tidak didukung. */
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
    if (numeric > 100) {
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
                  <CheckboxField
                    id="subsidy-enabled"
                    checked={form.data.enabled}
                    onChange={(checked) => form.setData("enabled", checked)}
                    label="Subsidi ongkir aktif"
                    standalone
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aktifkan untuk memberikan potongan biaya pengiriman kepada pembeli.
                  </p>
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Persentase subsidi
                </th>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="subsidy_value"
                      type="number"
                      aria-label="Persentase subsidi ongkir"
                      min={0}
                      max={100}
                      step="0.01"
                      value={subsidyValue}
                      onChange={(event) => {
                        setSubsidyValue(event.target.value)
                        setSubsidyTypeError("")
                      }}
                      className={`h-8 w-28 text-xs ${subsidyTypeError ? "border-destructive" : ""}`}
                      required
                    />
                    <span className="text-xs font-semibold text-muted-foreground">%</span>
                  </div>
                  {subsidyTypeError ? (
                    <p className="mt-1 text-xs text-destructive">{subsidyTypeError}</p>
                  ) : null}
                  {form.errors.subsidy_value ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.subsidy_value}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Persentase dari tarif kurir, maksimal 100. Isi 100 untuk ongkir gratis.
                  </p>
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Kurir terhubung
                </th>
                <td className="px-4 py-2.5">
                  <CheckboxField
                    id="subsidy-jnt-enabled"
                    checked={form.data.jnt_enabled}
                    onChange={(checked) => form.setData("jnt_enabled", checked)}
                    standalone
                    label={
                      <span>
                        J&T Cargo
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">
                          Skema subsidi menggunakan aturan kurir tersimpan. Hanya kurir yang dicentang yang mendapat subsidi.
                        </span>
                      </span>
                    }
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </form>
    </AdminLayout>
  )
}