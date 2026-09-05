import { Head, Link, useForm } from "@inertiajs/react"
import { useState } from "react"

import { Alert } from "@/components/admin/ui/alert"
import { Button } from "@/components/admin/ui/button"
import { FormErrorSummary } from "@/components/admin/ui/field"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import type { SelectOption } from "@/types"

type MediaClass = "internal" | "external" | "invalid"

type PreviewMedia = {
  url: string
  class: MediaClass
}

type PreviewRow = {
  row: number
  name: string
  parent_sku: string
  price: unknown
  stock: unknown
  media: PreviewMedia[]
  media_stats: Record<MediaClass, number>
}

type PreviewPayload = {
  rows: PreviewRow[]
  total: number
  verify_errors: string[]
}

const MEDIA_LABEL: Record<MediaClass, string> = {
  internal: "Internal siap",
  external: "Eksternal (akan diunduh)",
  invalid: "Tidak valid",
}

const MEDIA_CLASS_STYLES: Record<MediaClass, string> = {
  internal: "text-success",
  external: "text-info",
  invalid: "text-destructive",
}

export default function ImportCreate({
  submitUrl,
  previewUrl,
  csrf,
  internalTemplateUrl,
  stockPriceTemplateUrl,
  mediaUpdateTemplateUrl,
  types,
  backUrl,
}: {
  submitUrl: string
  backUrl?: string | null
  previewUrl: string
  csrf: string
  internalTemplateUrl: string
  stockPriceTemplateUrl: string
  mediaUpdateTemplateUrl: string
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
  const [preview, setPreview] = useState<PreviewPayload | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  // Flow wajib (kontrak owner 09-05): Mulai Import hanya aktif setelah
  // Periksa file SUKSES pada file yang sedang dipilih.
  const checked = preview !== null

  function setFile(file: File | null) {
    form.setData("file", file)
    setPreview(null)
    setPreviewError(null)
  }

  async function runPreview() {
    if (!form.data.file) return
    setPreviewing(true)
    setPreviewError(null)
    try {
      const body = new FormData()
      body.append("file", form.data.file)
      const res = await fetch(previewUrl, {
        method: "POST",
        body,
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRF-TOKEN": csrf,
        },
      })
      if (res.status === 419) {
        setPreviewError("Sesi kedaluwarsa. Muat ulang halaman lalu coba lagi.")
        setPreview(null)
        return
      }
      if (!res.ok) {
        setPreviewError("Gagal memeriksa file. Pastikan format Excel atau CSV benar.")
        setPreview(null)
        return
      }
      setPreview((await res.json()) as PreviewPayload)
    } catch {
      setPreviewError("Gagal memeriksa file. Coba lagi.")
      setPreview(null)
    } finally {
      setPreviewing(false)
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.post(submitUrl, { forceFormData: true })
  }

  const totals = preview
    ? preview.rows.reduce(
        (acc, row) => ({
          internal: acc.internal + row.media_stats.internal,
          external: acc.external + row.media_stats.external,
          invalid: acc.invalid + row.media_stats.invalid,
        }),
        { internal: 0, external: 0, invalid: 0 },
      )
    : null

  return (
    <AdminLayout
      backUrl={backUrl}
      title="Import Produk"
      description="Tiga mode: Import Katalog (buat/perbarui produk lengkap), Update Harga & Stok (ubah price/stock saja), dan Update Media (ganti atau tambah foto via URL)."
      actions={
        <div className="flex flex-wrap gap-2">
          {form.data.type === "stock_price_update" ? (
            <Button asChild variant="secondary">
              <a href={stockPriceTemplateUrl} download>Unduh Template Excel</a>
            </Button>
          ) : form.data.type === "media_update" ? (
            <Button asChild variant="secondary">
              <a href={mediaUpdateTemplateUrl} download>Unduh Template Excel</a>
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
      <Head title="Import Produk | Admin" />

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
              {form.data.type !== "media_update" ? (
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
              ) : null}
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  File katalog <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <FileDropzone
                    id="import-file"
                    accept=".xls,.xlsx,.xlsm,.csv"
                    file={form.data.file}
                    onFileChange={setFile}
                    error={form.errors.file}
                    title="Pilih file katalog"
                    hint="XLS, XLSX, XLSM, atau CSV. Maksimal 50 MB."
                    maxMb={50}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {(form.data.type === "catalog_import" || form.data.type === "media_update") && form.data.file ? (
          <div className="space-y-3">
            <Button type="button" variant="secondary" disabled={previewing} onClick={() => void runPreview()}>
              {previewing ? "Memeriksa..." : "Periksa file"}
            </Button>
            {previewError ? <Alert tone="danger">{previewError}</Alert> : null}
            {preview && totals && preview.verify_errors.length > 0 ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-semibold text-destructive">
                  Lolos pemeriksaan: {preview.verify_errors.length} masalah, perbaiki lalu periksa ulang.
                </p>
                <ul className="mt-2 space-y-1 text-xs text-foreground">
                  {preview.verify_errors.map((err, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-destructive">•</span>
                      <span>{err}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {preview && totals && preview.verify_errors.length === 0 ? (
              <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                <p className="text-sm font-semibold text-success">Semua baris lolos pemeriksaan. Mulai Import sudah aktif.</p>
              </div>
            ) : null}
            {preview && totals ? (
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-border bg-muted/40 px-4 py-2.5 text-xs">
                  <span className="font-semibold">{preview.total} baris terbaca</span>
                  <span className="text-success">{totals.internal} gambar internal siap</span>
                  <span className="text-info">{totals.external} gambar eksternal (diunduh saat import)</span>
                  {totals.invalid > 0 ? (
                    <span className="text-destructive">{totals.invalid} URL tidak valid</span>
                  ) : null}
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Baris</th>
                      <th className="px-4 py-2 font-medium">Nama produk</th>
                      <th className="px-4 py-2 font-medium">Harga</th>
                      <th className="px-4 py-2 font-medium">Stok</th>
                      <th className="px-4 py-2 font-medium">Gambar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.rows.map((row) => (
                      <tr key={row.row}>
                        <td className="px-4 py-2 tabular-nums text-muted-foreground">{row.row}</td>
                        <td className="px-4 py-2">{row.name || row.parent_sku || <span className="text-muted-foreground">(kosong)</span>}</td>
                        <td className="px-4 py-2 tabular-nums">{row.price == null ? "-" : String(row.price)}</td>
                        <td className="px-4 py-2 tabular-nums">{row.stock == null ? "-" : String(row.stock)}</td>
                        <td className="px-4 py-2">
                          {row.media.length === 0 ? (
                            <span className="text-muted-foreground">Tidak ada</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {row.media.map((m, i) => (
                                <span
                                  key={`${row.row}-${i}`}
                                  title={m.url}
                                  className={MEDIA_CLASS_STYLES[m.class]}
                                >
                                  {MEDIA_LABEL[m.class]}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

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

        {form.data.type === "catalog_import" ? (
          <Alert tone="info">
            Import memakai kontrak pengiriman admin: berat, tinggi, panjang (width), dan lebar/tebal
            packing wajib lebih dari 0. Baris yang belum lengkap tetap berhasil diproses tetapi produknya
            diarsipkan dengan alasan yang tampil pada data baris; tidak ada status draft. Media yang belum
            selesai diproses masuk antrean media.
          </Alert>
        ) : (
          <Alert tone="info">
            Mode ini hanya mengubah kolom yang dipilih. SKU yang tidak dikenal ditandai gagal dan tidak membuat produk baru.
          </Alert>
        )}

        <div className="flex justify-end gap-2">
          <Button asChild variant="secondary">
            <Link href={routeUrl("admin.imports.index")}>Batal</Link>
          </Button>
          <Button type="submit" disabled={!form.data.file || !checked || form.processing}>
            {form.processing ? "Mengunggah..." : "Mulai Import"}
          </Button>
          {!checked ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Wajib menekan Periksa file dan lolos pemeriksaan dulu sebelum Mulai Import aktif.
            </p>
          ) : null}
        </div>
      </form>
    </AdminLayout>
  )
}
