import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
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
  jntConfigured,
}: {
  title: string
  description: string
  settings: SubsidySettings
  submitUrl: string
  jntConfigured: boolean
}) {
  const form = useForm({
    enabled: settings.enabled,
    subsidy_type: settings.subsidy_type,
    subsidy_value: settings.subsidy_value,
    jnt_enabled: settings.jnt_enabled,
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
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
          <h2 className="text-base font-bold">Status subsidi ongkir</h2>
          <p className="text-sm text-muted-foreground">
            Aktifkan untuk memberikan potongan biaya pengiriman kepada pembeli.
          </p>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-4 rounded border-border"
              checked={form.data.enabled}
              onChange={(event) => form.setData("enabled", event.target.checked)}
            />
            Subsidi ongkir aktif
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-bold">Skema subsidi</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="subsidy_type" label="Jenis" error={form.errors.subsidy_type}>
              <Select
                id="subsidy_type"
                value={form.data.subsidy_type}
                onChange={(event) =>
                  form.setData("subsidy_type", event.target.value as "percent" | "fixed")
                }
              >
                <option value="percent">Persentase dari ongkir (%)</option>
                <option value="fixed">Nominal tetap (Rp)</option>
              </Select>
            </Field>
            <Field
              id="subsidy_value"
              label={form.data.subsidy_type === "percent" ? "Nilai persentase" : "Nilai nominal"}
              error={form.errors.subsidy_value}
            >
              <Input
                id="subsidy_value"
                type="number"
                min={0}
                step="0.01"
                max={form.data.subsidy_type === "percent" ? 100 : undefined}
                value={form.data.subsidy_value}
                onChange={(event) => form.setData("subsidy_value", Number(event.target.value))}
                required
              />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">Kurir terhubung</h2>
          <p className="text-sm text-muted-foreground">
            Hanya kurir yang dicentang yang mendapat subsidi. Saat ini toko memakai J&T Cargo.
          </p>
          <div className="rounded-lg border border-border p-4">
            <label className="flex items-start gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-border"
                checked={form.data.jnt_enabled}
                onChange={(event) => form.setData("jnt_enabled", event.target.checked)}
              />
              <span>
                J&T Cargo
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {jntConfigured
                    ? "Kredensial J&T terdeteksi di konfigurasi."
                    : "API key belum di-set — estimasi memakai tarif lokal."}
                </span>
              </span>
            </label>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan perubahan"}
          </Button>
          <Button asChild type="button" variant="secondary">
            <Link href="/admin/cod-settings">Ke Biaya COD</Link>
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
