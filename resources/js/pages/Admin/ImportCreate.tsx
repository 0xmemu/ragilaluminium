import { Head, Link, useForm } from "@inertiajs/react"

import { Alert } from "@/components/admin/ui/alert"
import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import type { SelectOption } from "@/types"

export default function ImportCreate({
  submitUrl,
  types,
}: {
  submitUrl: string
  types: SelectOption[]
}) {
  const form = useForm<{
    type: string
    file: File | null
    stock_mode: "file" | "manual"
    manual_stock: number | string
  }>({
    type: types[0]?.value ?? "shopee_mass_upload",
    file: null,
    stock_mode: "file",
    manual_stock: 0,
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.post(submitUrl, { forceFormData: true })
  }

  return (
    <AdminLayout
      title="Import katalog"
      description="Unggah file Excel atau CSV untuk diproses melalui antrean import."
      actions={
        <Button asChild variant="secondary">
          <Link href={routeUrl("admin.imports.index")}>Riwayat import</Link>
        </Button>
      }
    >
      <Head title="Import Katalog | Admin" />

      <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
        <FormErrorSummary errors={form.errors} />
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <Field id="import-type" label="Tipe import" required error={form.errors.type}>
            <Select value={form.data.type} onChange={(event) => form.setData("type", event.target.value)}>
              {types.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </Select>
          </Field>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field
              id="import-stock-mode"
              label="Sumber stok"
              required
              error={form.errors.stock_mode}
              hint="Gunakan angka dari file, atau timpa seluruh stok varian dengan satu nilai manual."
            >
              <Select
                value={form.data.stock_mode}
                onChange={(event) => form.setData("stock_mode", event.target.value as "file" | "manual")}
              >
                <option value="file">Gunakan stok dari file</option>
                <option value="manual">Gunakan stok manual</option>
              </Select>
            </Field>
            {form.data.stock_mode === "manual" ? (
              <Field
                id="import-manual-stock"
                label="Stok manual"
                required
                error={form.errors.manual_stock}
                hint="Nilai ini diterapkan ke setiap varian yang diproses."
              >
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.data.manual_stock}
                  onChange={(event) => form.setData("manual_stock", event.target.value)}
                />
              </Field>
            ) : null}
          </div>

          <div className="mt-6">
            <FileDropzone
              id="import-file"
              accept=".xls,.xlsx,.xlsm,.csv"
              file={form.data.file}
              onFileChange={(file) => form.setData("file", file)}
              error={form.errors.file}
              title="Pilih file katalog"
              hint="XLS, XLSX, XLSM, atau CSV. Maksimal 50 MB."
            />
          </div>

          {form.progress ? (
            <div className="mt-4" role="status">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Mengunggah</span>
                <span className="tabular-nums">{form.progress.percentage}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden bg-muted">
                <div className="h-full bg-primary" style={{ width: `${form.progress.percentage}%` }} />
              </div>
            </div>
          ) : null}

          <Alert tone="info" className="mt-6">
            Setelah unggahan selesai, file diproses oleh queue. Detail job menampilkan jumlah baris
            berhasil dan gagal. Pilihan sumber stok juga disimpan pada job agar retry memakai aturan
            yang sama.
          </Alert>

          <div className="mt-6 flex justify-end gap-2">
            <Button asChild variant="secondary">
              <Link href={routeUrl("admin.imports.index")}>Batal</Link>
            </Button>
            <Button type="submit" disabled={!form.data.file || form.processing}>
              {form.processing ? "Mengunggah..." : "Mulai import"}
            </Button>
          </div>
        </section>
      </form>
    </AdminLayout>
  )
}
