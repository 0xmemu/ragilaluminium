import { Head, Link, useForm } from "@inertiajs/react"

import { Button } from "@/components/admin/ui/button"
import { FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { humanize } from "@/lib/format"


interface ModelRecord {
  id: number
  name: string
  product_category?: string | null
  product_model?: string | null
  image_url?: string | null
  description?: string | null
  keywords?: string[]
  menu_href?: string | null
  status: string
  sort_order: number
}

// Template label pill (kontrak owner 2026-09-02: maksimal 2 kata).
// Admin pilih dari daftar ini saat mengisi kata kunci; input manual tetap
// bisa selama tidak lebih dari 2 kata.
const PILL_PRESETS: string[] = [
  "Tahan Air",
  "Anti Debu",
  "Kaca Kuat",
  "Hemat Ruang",
  "Gerak Ringan",
  "Klasik Elegan",
  "Ventilasi Penuh",
  "Mudah Dirawat",
  "Sirkulasi Baik",
  "Buka Penuh",
  "Sirkulasi Optimal",
  "Anti Basah",
  "Rapi Modern",
  "Bukaan Lebar",
  "Bukaan Samping",
  "Privasi Terjaga",
  "Cahaya Maksimal",
  "Tampilan Modern",
  "Kedap Debu",
  "Garansi Penuh",
]

function wordCount(value: string): number {
  return value.trim().length === 0 ? 0 : value.trim().split(/\s+/).length
}

export default function ModelProductForm({
  modelProduct,
  statuses,
  categories,
  models,
  submitUrl,
  indexUrl,
  backUrl,
}: {
  modelProduct: ModelRecord | null
  statuses: string[]
  categories: Array<{ value: string; label: string }>
  models: Array<{ value: string; label: string }>
  submitUrl: string
  indexUrl: string
  backUrl?: string | null
}) {
  const editing = Boolean(modelProduct)
  const form = useForm({
    name: modelProduct?.name ?? "",
    product_category: modelProduct?.product_category ?? "",
    product_model: modelProduct?.product_model ?? "",
    image_url: modelProduct?.image_url ?? "",
    description: modelProduct?.description ?? "",
    keywords: modelProduct?.keywords ?? [],
    menu_href: modelProduct?.menu_href ?? "",
    status: modelProduct?.status ?? "draft",
    sort_order: modelProduct?.sort_order ?? 0,
  })

  return (
    <AdminLayout
      backUrl={backUrl}
      title={editing ? "Edit model produk" : "Tambah model produk"}
      description="Tautkan ke kategori/model katalog agar statistik dan link storefront akurat."
      actions={
        <Button asChild variant="secondary">
          <Link href={indexUrl}>Batal</Link>
        </Button>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Model Produk | Admin`} />
      <form
        className="w-full space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (editing) form.put(submitUrl)
          else form.post(submitUrl)
        }}
      >
        <FormErrorSummary errors={form.errors} />

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Nama tampilan <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <Input value={form.data.name} onChange={(event) => form.setData("name", event.target.value)} className="h-8 text-xs" />
                  {form.errors.name ? <p className="mt-1 text-xs text-destructive">{form.errors.name}</p> : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Kategori katalog
                </th>
                <td className="px-4 py-2.5">
                  <Select
                    value={form.data.product_category}
                    onChange={(event) => form.setData("product_category", event.target.value)}
                    className="h-8 w-72 text-xs"
                  >
                    <option value="">Pilih</option>
                    {categories.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                  {form.errors.product_category ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.product_category}</p>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Kode model katalog
                </th>
                <td className="px-4 py-2.5">
                  <Select
                    value={form.data.product_model}
                    onChange={(event) => form.setData("product_model", event.target.value)}
                    className="h-8 w-72 text-xs"
                  >
                    <option value="">Pilih</option>
                    {models.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                  {form.errors.product_model ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.product_model}</p>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Status <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <Select value={form.data.status} onChange={(event) => form.setData("status", event.target.value)} className="h-8 w-48 text-xs">
                    {statuses.map((status) => (
                      <option key={status} value={status}>{humanize(status)}</option>
                    ))}
                  </Select>
                  {form.errors.status ? <p className="mt-1 text-xs text-destructive">{form.errors.status}</p> : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">URL gambar</th>
                <td className="px-4 py-2.5">
                  <Input
                    type="url"
                    value={form.data.image_url}
                    onChange={(event) => form.setData("image_url", event.target.value)}
                    className="h-8 text-xs"
                  />
                  {form.errors.image_url ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.image_url}</p>
                  ) : null}
                  {form.data.image_url ? (
                    <img src={form.data.image_url} alt="" className="mt-2 max-h-40 border border-border object-cover" />
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Deskripsi model</th>
                <td className="px-4 py-2.5">
                  <Textarea
                    rows={3}
                    value={form.data.description}
                    onChange={(event) => form.setData("description", event.target.value)}
                    className="text-xs"
                    placeholder="Contoh: Jendela sliding cocok untuk ruangan dengan bukaan lebar…"
                  />
                  {form.errors.description ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tampil di halaman detail model storefront. Kosongkan untuk memakai teks default sistem.
                  </p>
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Kata kunci (opsional)
                </th>
                <td className="px-4 py-2.5">
                  <div className="max-w-lg space-y-2">
                    {form.data.keywords.map((keyword, index) => {
                      const over = wordCount(keyword) > 2
                      return (
                      <div key={index} className="flex items-center gap-2">
                        <Select
                          className="h-8 w-44 shrink-0 text-xs"
                          value=""
                          onChange={(event) => {
                            if (!event.target.value) return
                            const next = form.data.keywords.map((item, i) =>
                              i === index ? event.target.value : item,
                            )
                            form.setData("keywords", next)
                          }}
                          aria-label={`Pilih template label ${index + 1}`}
                        >
                          <option value="">Template...</option>
                          {PILL_PRESETS.filter((preset) => !form.data.keywords.includes(preset) || preset === keyword).map((preset) => (
                            <option key={preset} value={preset}>{preset}</option>
                          ))}
                        </Select>
                        <Input
                          className={`h-8 min-w-0 flex-1 text-xs ${over ? "border-destructive" : ""}`}
                          value={form.data.keywords[index]}
                          onChange={(event) => {
                            const next = form.data.keywords.map((item, i) =>
                              i === index ? event.target.value : item,
                            )
                            form.setData("keywords", next)
                          }}
                          placeholder={`Label ${index + 1}, maks 2 kata`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          className="size-8 shrink-0 px-0"
                          disabled={form.data.keywords.length <= 1}
                          onClick={() => {
                            const next = form.data.keywords.filter((_, i) => i !== index)
                            form.setData("keywords", next)
                          }}
                          aria-label={`Hapus kata kunci ${index + 1}`}
                        >
                          <Icon name="trash-2" className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                      )
                    })}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={form.data.keywords.length >= 6}
                      onClick={() => form.setData("keywords", [...form.data.keywords, ""])}
                    >
                      <Icon name="plus" className="size-4" aria-hidden="true" />
                      Tambah kata kunci
                    </Button>
                  </div>
                  {form.errors.keywords ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.keywords}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tiap baris menjadi satu pill di hero halaman detail model. Pilih dari template atau tulis sendiri, maksimal 2 kata. Maksimal 6 pill.
                  </p>
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  URL menu kustom (opsional)
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    type="url"
                    value={form.data.menu_href}
                    onChange={(event) => form.setData("menu_href", event.target.value)}
                    className="h-8 text-xs"
                    placeholder="https://… atau /products/…"
                  />
                  {form.errors.menu_href ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.menu_href}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dipakai di menu kategori beranda. Kosongkan untuk memakai link otomatis ke halaman model.
                  </p>
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Urutan</th>
                <td className="px-4 py-2.5">
                  <Input
                    type="number"
                    min="0"
                    value={form.data.sort_order}
                    onChange={(event) => form.setData("sort_order", Number(event.target.value))}
                    className="h-8 w-32 text-xs"
                  />
                  {form.errors.sort_order ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.sort_order}</p>
                  ) : null}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2">
          <Button asChild variant="secondary"><Link href={indexUrl}>Batal</Link></Button>
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan model"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}