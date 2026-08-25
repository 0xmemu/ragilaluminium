import { Head, Link, useForm } from "@inertiajs/react"

import { Alert } from "@/components/admin/ui/alert"
import { Button } from "@/components/admin/ui/button"
import { FormErrorSummary } from "@/components/admin/ui/field"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import type { SelectOption } from "@/types"

export default function ImportCreate({
  submitUrl,
  internalTemplateUrl,
  stockPriceTemplateUrl,
  types,
}: {
  submitUrl: string
  internalTemplateUrl: string
  stockPriceTemplateUrl: string
  types: SelectOption[]
}) {
  const form = useForm<{
    type: string
    file: File | null
    stock_mode: "file" | "manual"
    manual_stock: number | string
  }>({
    type: "catalog_import",
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
      description="Dua mode: Import Katalog (buat/perbarui produk lengkap) dan Update Harga & Stok (ubah price/stock saja)."
      actions={
        <div className="flex flex-wrap gap-2">
          {form.data.type === "stock_price_update" ? (
            <Button asChild variant="secondary">
              <a href={stockPriceTemplateUrl} download>Unduh Template Excel</a>
            </Button>
          ) : (
            <Button asChild variant="secondary">
              <a href={internalTemplateUrl} download>Unduh Template Excel</a>
            </Button>
          )}
          <Button asChild variant="secondary">
            <Link href={routeUrl("admin.imports.index")}>Riwayat import</Link>
          </Button>
        </div>
      }
    >
      <Head title="Import Katalog | Admin" />

      <form onSubmit={submit} className="w-full space-y-5">
        <FormErrorSummary errors={form.errors} />

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Tipe import <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <Select
                    value={form.data.type}
                    onChange={(event) => form.setData("type", event.target.value)}
                    className="h-8 text-xs"
                  >
                    {types.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </Select>
                  {form.errors.type ? <p className="mt-1 text-xs text-destructive">{form.errors.type}</p> : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Sumber stok <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Select
                      value={form.data.stock_mode}
                      onChange={(event) => form.setData("stock_mode", event.target.value as "file" | "manual")}
                      className="h-8 w-56 text-xs"
                    >
                      <option value="file">Gunakan stok dari file</option>
                      <option value="manual">Gunakan stok manual</option>
                    </Select>
                    {form.data.stock_mode === "manual" ? (
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={form.data.manual_stock}
                        onChange={(event) => form.setData("manual_stock", event.target.value)}
                        className="h-8 w-32 text-xs"
                      />
                    ) : null}
                  </div>
                  {form.errors.stock_mode ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.stock_mode}</p>
                  ) : null}
                  {form.errors.manual_stock ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.manual_stock}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Gunakan angka dari file, atau timpa seluruh stok varian dengan satu nilai manual.
                  </p>
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  File katalog <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <FileDropzone
                    id="import-file"
                    accept=".xls,.xlsx,.xlsm,.csv"
                    file={form.data.file}
                    onFileChange={(file) => form.setData("file", file)}
                    error={form.errors.file}
                    title="Pilih file katalog"
                    hint="XLS, XLSX, XLSM, atau CSV. Maksimal 50 MB."
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {form.progress ? (
          <div role="status">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Mengunggah</span>
              <span className="tabular-nums">{form.progress.percentage}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${form.progress.percentage}%` }} />
            </div>
          </div>
        ) : null}

        <Alert tone="info">
          Import memakai kontrak pengiriman admin: berat, tinggi, panjang (width), dan lebar/tebal
          packing wajib lebih dari 0. Baris yang belum lengkap tetap berhasil diproses tetapi produknya
          diarsipkan dengan alasan yang tampil pada data baris; tidak ada status draft. Media yang belum
          selesai diproses masuk antrean media.
        </Alert>

        <div className="flex justify-end gap-2">
          <Button asChild variant="secondary">
            <Link href={routeUrl("admin.imports.index")}>Batal</Link>
          </Button>
          <Button type="submit" disabled={!form.data.file || form.processing}>
            {form.processing ? "Mengunggah..." : "Mulai Import"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}