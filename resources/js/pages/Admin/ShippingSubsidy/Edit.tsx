import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { CheckboxField, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { SubmitGateButton } from "@/components/admin/ui/submit-gate-button"
import { jagaGerbang } from "@/lib/submit-gate"

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

  // Kontrak halaman pengaturan: dibuka dalam keadaan terkunci. Isian baru bisa
  // diubah setelah admin menekan Edit, supaya halaman tidak rawan tersunting
  // tanpa sengaja saat hanya ingin membaca kondisi aktif.
  const [mode, setMode] = React.useState<"view" | "edit">("view")
  const terkunci = mode === "view"

  function batal() {
    // Jangan router.reload(): pada Inertia versi repo ini state komponen
    // dipertahankan sehingga mode edit bertahan walau sudah dibatalkan.
    form.resetAndClearErrors()
    setSubsidyValue(String(settings.subsidy_value ?? 0))
    setSubsidyTypeError("")
    setMode("view")
  }

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
    form.put(submitUrl, {
      preserveScroll: true,
      onSuccess: () => {
        // Simpan berhasil = kondisi baru jadi acuan Batal berikutnya.
        form.setDefaults()
        setMode("view")
      },
    })
  }


  // Gerbang isi tombol simpan: kolom wajibnya mengikuti aturan `required`
  // controller, jadi frontend tidak menciptakan aturan baru.
  const gerbang = {
    fields: {"subsidy_value": "Persentase subsidi ongkir"},
    requireChange: true,
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={form.data.enabled ? "active" : "inactive"} />
          {mode === "view" ? (
            <Button type="button" size="sm" className="h-8 px-4" onClick={() => setMode("edit")}>
              <Icon name="pencil" className="size-3.5" aria-hidden="true" />
              Edit
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" size="sm" className="h-8 px-4" onClick={batal}>
                Batal
              </Button>
                            <SubmitGateButton
                form={form}
                {...gerbang}
                formId="subsidy-form"
                size="sm"
                className="h-8 px-4"
              >
                Simpan
              </SubmitGateButton>
            </>
          )}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <form id="subsidy-form" onSubmit={jagaGerbang(gerbang, form, submit)} className="w-full space-y-5">
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
                    disabled={terkunci}
                  />
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
                      disabled={terkunci}
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
                    disabled={terkunci}
                    label="J&T Cargo"
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