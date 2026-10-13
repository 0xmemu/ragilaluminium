import { Head, Link, useForm } from "@inertiajs/react"
import { useState } from "react"

import { Alert } from "@/components/admin/ui/alert"
import { Button } from "@/components/admin/ui/button"
import { Icon } from "@/components/shared/icon"
import { FormErrorSummary } from "@/components/admin/ui/field"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { Select } from "@/components/admin/ui/select"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import type { SelectOption } from "@/types"

type MediaClass = "internal" | "external" | "invalid"

type PreviewMedia = {
  kolom?: string
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
  rows?: PreviewRow[]
  total: number
  total_products?: number
  verify_errors: string[]
  verify_warnings?: string[];
  skipped_rows?: number
  changes?: string[]
  changed_rows?: number
  unchanged_rows?: number
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
  previewUpdateUrl,
  csrf,
  productImportTemplateUrl,
  stockPriceTemplateUrl,
  mediaUpdateTemplateUrl,
  downloadFilters,
  types,
  backUrl,
}: {
  submitUrl: string
  backUrl?: string | null
  previewUrl: string
  previewUpdateUrl: string
  csrf: string
  productImportTemplateUrl: string
  stockPriceTemplateUrl: string
  mediaUpdateTemplateUrl: string
  downloadFilters: {
    kategori: string[]
    model: string[]
    sub_model: string[]
  }
  types: SelectOption[]
}) {
  // Filter unduhan template update. Dikirim sebagai query string supaya
  // admin mengunduh hanya bagian katalog yang dia butuhkan.
  const [downloadKategori, setDownloadKategori] = useState("")
  const [downloadModel, setDownloadModel] = useState("")
  const [downloadSubModel, setDownloadSubModel] = useState("")

  function buildTemplateUrl(baseUrl: string): string {
    const params = new URLSearchParams()
    if (downloadKategori) params.set("kategori", downloadKategori)
    if (downloadModel) params.set("model", downloadModel)
    if (downloadSubModel) params.set("sub_model", downloadSubModel)
    const query = params.toString()
    return query ? `${baseUrl}?${query}` : baseUrl
  }

  // Sumber stok tidak lagi jadi pilihan: stok SELALU dibaca dari berkas.
  // Pilihan mode manual dihapus karena menimbulkan dua jalur yang harus
  // dirawat padahal template sudah menyediakan kolom stok.
  const form = useForm<{
    type: string
    file: File | null
  }>({
    type: "catalog_import",
    file: null,
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

  // Ganti jenis import = periksa ulang wajib, karena aturan tiap jenis berbeda
  // (berkas yang lolos sebagai update bisa gagal sebagai import katalog).
  function invalidatePreview() {
    setPreview(null)
    setPreviewError(null)
  }

  const previewEndpoint =
    form.data.type === "stock_price_update" || form.data.type === "media_update"
      ? previewUpdateUrl
      : previewUrl

  async function runPreview() {
    if (!form.data.file) return
    setPreviewing(true)
    setPreviewError(null)
    try {
      const body = new FormData()
      body.append("file", form.data.file)
      if (form.data.type === "stock_price_update" || form.data.type === "media_update") {
        body.append("type", form.data.type)
      }
      const res = await fetch(previewEndpoint, {
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

  const totals = preview?.rows
    ? preview.rows.reduce(
        (acc, row) => ({
          internal: acc.internal + (row.media_stats?.internal ?? 0),
          external: acc.external + (row.media_stats?.external ?? 0),
          invalid: acc.invalid + (row.media_stats?.invalid ?? 0),
        }),
        { internal: 0, external: 0, invalid: 0 },
      )
    : null

  return (
    <AdminLayout
      backUrl={backUrl}
      title="Import Produk"
      description="Tiga mode: Import Produk (buat produk dan varian baru), Update Produk (ubah harga, stok, deskripsi), dan Update Media (ganti foto via URL). Template update dapat disaring per kategori, model, atau sub model."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {form.data.type === "stock_price_update" ? (
            <Button asChild variant="secondary">
              <a href={buildTemplateUrl(stockPriceTemplateUrl)} download>Unduh Template Update Produk</a>
            </Button>
          ) : form.data.type === "media_update" ? (
            <Button asChild variant="secondary">
              <a href={buildTemplateUrl(mediaUpdateTemplateUrl)} download>Unduh Template Update Media</a>
            </Button>
          ) : (
            <Button asChild variant="secondary">
              <a href={productImportTemplateUrl} download>Unduh Template Import Produk</a>
            </Button>
          )}
          <Button asChild variant="secondary">
            <Link href={routeUrl("admin.imports.index")}>Riwayat import</Link>
          </Button>
          <div className="mx-1 h-6 w-px bg-border" />
          <Button
            type="button"
            variant="secondary"
            form="import-form"
            disabled={!form.data.file || previewing}
            onClick={() => void runPreview()}
          >
            {previewing ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="spinner" className="size-3.5 animate-spin" aria-hidden="true" />
                Memeriksa berkas...
              </span>
            ) : (
              "Periksa file"
            )}
          </Button>
          <Button type="submit" form="import-form" disabled={!form.data.file || !checked || form.processing}>
            {form.processing ? "Mengunggah..." : "Mulai Import"}
          </Button>
        </div>
      }
    >
      <Head title="Import Produk | Admin" />

      <form id="import-form" onSubmit={submit} className="w-full space-y-5">
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
                    onChange={(event) => { form.setData("type", event.target.value); invalidatePreview() }}
                    className="h-8 text-xs"
                  >
                    {types.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </Select>
                  {form.errors.type ? <p className="mt-1 text-xs text-destructive">{form.errors.type}</p> : null}
                </td>
              </tr>
              {form.data.type === "stock_price_update" || form.data.type === "media_update" ? (
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Filter unduhan template
                </th>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={downloadKategori}
                      onChange={(event) => setDownloadKategori(event.target.value)}
                      className="h-8 w-40 text-xs"
                      aria-label="Filter kategori unduhan"
                    >
                      <option value="">Semua kategori</option>
                      {downloadFilters.kategori.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </Select>
                    <Select
                      value={downloadModel}
                      onChange={(event) => setDownloadModel(event.target.value)}
                      className="h-8 w-44 text-xs"
                      aria-label="Filter model unduhan"
                    >
                      <option value="">Semua model</option>
                      {downloadFilters.model.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </Select>
                    <Select
                      value={downloadSubModel}
                      onChange={(event) => setDownloadSubModel(event.target.value)}
                      className="h-8 w-36 text-xs"
                      aria-label="Filter sub model unduhan"
                    >
                      <option value="">Semua sub model</option>
                      {downloadFilters.sub_model.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </Select>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Filter ini menyaring isi template update. Unduh tanpa filter berarti seluruh katalog.
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
                    hint="XLS, XLSX, XLSM, atau CSV. Maksimal 50 MB atau 50.000 baris per berkas. Batas praktis sekitar 30.000 baris (proses sekitar 30 menit), lebih dari itu pecah menjadi beberapa berkas."
                    maxMb={50}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {form.data.file ? (
          <div className="space-y-3">
            {previewError ? <Alert tone="danger">{previewError}</Alert> : null}
            {preview && preview.verify_errors.length > 0 ? (
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
            {preview && (preview.verify_warnings ?? []).length > 0 ? (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-sm font-semibold text-foreground">Catatan pemeriksaan:</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {(preview.verify_warnings ?? []).map((w, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span>•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {preview && preview.verify_errors.length === 0 ? (
              <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                <p className="text-sm font-semibold text-success">Semua baris lolos pemeriksaan. Mulai Import sudah aktif.</p>
                {preview.changes && preview.changes.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {preview.changed_rows ?? 0} baris akan diubah, {preview.unchanged_rows ?? 0} tidak berubah
                    {preview.skipped_rows ? `, ${preview.skipped_rows} dilewati` : ""}.
                  </p>
                ) : null}
              </div>
            ) : null}
            {preview && preview.changes && preview.changes.length > 0 ? (
              <div className="max-h-60 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-1">
                <p className="font-semibold text-foreground">Perubahan yang akan diterapkan:</p>
                {preview.changes.slice(0, 50).map((c, i) => (
                  <p key={i} className="text-muted-foreground">• {c}</p>
                ))}
                {preview.changes.length > 50 ? (
                  <p className="text-muted-foreground italic">dan {preview.changes.length - 50} perubahan lainnya...</p>
                ) : null}
              </div>
            ) : null}
            {preview && totals && preview.rows ? (
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-border bg-muted/40 px-4 py-2.5 text-xs">
                  <span className="font-semibold">{preview.total_products ? `${preview.total_products} produk (${preview.total} baris varian) terbaca` : `${preview.total} baris terbaca`}</span>
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
                                  title={m.kolom ? `${m.kolom} - ${m.url}` : m.url}
                                  className={MEDIA_CLASS_STYLES[m.class]}
                                >
                                  {m.kolom ? `${m.kolom}: ` : ""}
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

        <div className="flex justify-end">
          {!checked ? (
            <p className="text-xs text-muted-foreground">
              Wajib menekan Periksa file dan lolos pemeriksaan dulu sebelum Mulai Import aktif.
            </p>
          ) : null}
        </div>
      </form>
    </AdminLayout>
  )
}
