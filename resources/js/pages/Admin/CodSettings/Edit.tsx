import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { HintTip } from "@/components/admin/ui/hint-tip"
import { CheckboxField, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { can, useAdminCapabilities } from "@/lib/capabilities"
import { SubmitGateButton } from "@/components/admin/ui/submit-gate-button"
import { jagaGerbang } from "@/lib/submit-gate"

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
  const capabilities = useAdminCapabilities()
  const canManage = can("cod_settings.manage", capabilities)

  // Kontrak halaman pengaturan: dibuka dalam keadaan terkunci. Isian baru bisa
  // diubah setelah admin menekan Edit, supaya halaman tidak rawan tersunting
  // tanpa sengaja saat hanya ingin membaca kondisi aktif.
  const [mode, setMode] = React.useState<"view" | "edit">("view")
  const terkunci = mode === "view"

  function batal() {
    // Jangan router.reload(): pada Inertia versi repo ini state komponen
    // dipertahankan sehingga mode edit bertahan walau sudah dibatalkan.
    form.resetAndClearErrors()
    setMode("view")
  }

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
    fields: {"fee_value": "Nilai biaya penanganan COD"},
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
            <Button
              type="button"
              size="sm"
              className="h-8 px-4"
              onClick={() => setMode("edit")}
              disabled={!canManage}
              title={canManage ? undefined : "Kamu tidak punya akses mengubah biaya COD"}
            >
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
                formId="cod-settings-form"
                size="sm"
                className="h-8 px-4"
                extraDisabled={!canManage}
                extraDisabledReason="Kamu tidak punya akses mengubah biaya COD"
              >
                Simpan
              </SubmitGateButton>
            </>
          )}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <form id="cod-settings-form" onSubmit={jagaGerbang(gerbang, form, submit)} className="w-full space-y-5">
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
                  <CheckboxField
                    id="cod-enabled"
                    checked={form.data.enabled}
                    onChange={(checked) => form.setData("enabled", checked)}
                    label="Layanan COD aktif"
                    standalone
                    disabled={terkunci}
                  />
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  <HintTip
                    label="Biaya penanganan (handling fee)"
                    hint="Nilai biaya (%). Rumus: biaya COD = persen x (subtotal produk setelah voucher + TOTAL ongkos kirim yang dibayar pembeli, SUDAH TERMASUK asuransi). Subtotal produk memakai harga setelah diskon (flash sale atau diskon biasa) dan voucher. Contoh: harga produk Rp 100.000, diskon Rp 10.000, total ongkos kirim Rp 21.000 (termasuk asuransi). Biaya COD = 4% x (Rp 90.000 + Rp 21.000) = Rp 4.440."
                  />
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    id="fee_value"
                    type="number"
                    aria-label="Nilai biaya penanganan COD dalam persen"
                    min={0}
                    step="0.01"
                    value={form.data.fee_value}
                    onChange={(event) => form.setData("fee_value", event.target.value)}
                    className="h-8 w-44 text-xs"
                    disabled={terkunci}
                    required
                  />
                  {form.errors.fee_value ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.fee_value}</p>
                  ) : null}
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
                    aria-label="Limit nilai transaksi COD"
                    min={0}
                    step="1"
                    value={form.data.max_order_amount}
                    onChange={(event) => form.setData("max_order_amount", event.target.value)}
                    className="h-8 w-44 text-xs"
                    disabled={terkunci}
                    placeholder="Contoh: 5000000"
                  />
                  {form.errors.max_order_amount ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.max_order_amount}</p>
                  ) : null}
                </td>
              </tr>
            </tbody>
          </table>
        </div>


      </form>
    </AdminLayout>
  )
}