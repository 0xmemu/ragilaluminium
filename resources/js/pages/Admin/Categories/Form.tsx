import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { CheckboxField, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { SubmitGateButton } from "@/components/admin/ui/submit-gate-button"
import AdminLayout from "@/layouts/admin-layout"
import { Icon } from "@/components/shared/icon"
import { jagaGerbang } from "@/lib/submit-gate"

interface CategoryData {
  id?: number
  code: string
  name: string
  slug: string
  seo_title?: string | null
  seo_description?: string | null
  sort_order: string
  is_active: boolean
  products_count?: number
  public_url?: string
  products_url?: string
}

interface Props {
  title: string
  description: string
  backUrl: string
  category: CategoryData | null
  /** Nomor urut usulan untuk kategori baru (selalu di bawah yang sudah ada). */
  nextSortOrder?: number
  submitUrl: string
}

function toSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export default function CategoryForm({
  title,
  description,
  category,
  nextSortOrder = 1,
  submitUrl,
  backUrl,
}: Props) {
  const form = useForm({
    code: category?.code ?? "",
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    sort_order: String(category?.sort_order ?? nextSortOrder),
    is_active: category?.is_active ?? true,
  })

  // Slug mengikuti nama selama admin belum menyentuh kolomnya. Penanda ini
  // mencegah slug membeku di huruf pertama: dulu kolom dianggap sudah terisi
  // setelah ketukan pertama, sehingga "Gerbang" berakhir menjadi "g".
  const slugTouched = React.useRef(Boolean(category))

  // Gerbang isi (kontrak "logika tombol"): kolom wajibnya mengikuti aturan
  // `required` CategoryController. Pada halaman edit, tombol juga menunggu
  // sampai ada perubahan sebelum bisa disimpan.
  const gerbang = {
    fields: { name: "Nama Kategori" },
    requireChange: Boolean(category),
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    form.transform((data) => ({
      ...data,
      sort_order: data.sort_order === "" ? null : Number(data.sort_order),
    }))
    if (category) {
      form.put(submitUrl)
    } else {
      form.post(submitUrl)
    }
  }


  return (
    <AdminLayout
      title={title}
      description={description}
      backUrl={backUrl}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={backUrl}>Batal</Link>
          </Button>
          <SubmitGateButton
            form={form}
            {...gerbang}
            formId="category-form"
            label={category ? "Simpan" : "Tambah"}
            processing={form.processing}
          />
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <form
        id="category-form"
        onSubmit={jagaGerbang(gerbang, form, submit)}
        className="w-full space-y-6"
      >
        <FormErrorSummary errors={form.errors} />

        {/* 1. Identitas Kategori (Table-First) */}
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Identitas Kategori</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Informasi dasar, penamaan, dan struktur URL untuk kategori di katalog website.
            </p>
          </div>
          <table className="w-full">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="w-64 px-4 py-3 text-left align-top text-xs font-semibold text-foreground">
                  Nama Kategori <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-3">
                  <Input
                    id="cat-name"
                    value={form.data.name}
                    onChange={(e) => {
                      const name = e.target.value
                      form.setData((prev) => ({
                        ...prev,
                        name,
                        ...(!slugTouched.current ? { slug: toSlug(name) } : {}),
                      }))
                    }}
                    placeholder="Contoh: Jendela"
                    required
                    className="max-w-md"
                  />
                  {form.errors.name ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.name}</p>
                  ) : null}
                </td>
              </tr>

              <tr>
                <th className="w-64 px-4 py-3 text-left align-top text-xs font-semibold text-foreground">
                  Kode Kategori
                </th>
                <td className="px-4 py-3">
                  {category ? (
                    <div className="space-y-1">
                      <p className="font-mono text-xs font-semibold text-foreground">
                        {form.data.code}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(category.products_count ?? 0) > 0
                          ? `Kode terkunci karena sudah dipakai ${category.products_count} produk. Menjadi awalan SKU produk di dalamnya.`
                          : "Kode identifikasi internal kategori di sistem."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-mono text-xs text-muted-foreground">
                        {form.data.name
                          ? form.data.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")
                          : "(Dihasilkan otomatis oleh sistem dari nama kategori)"}
                      </p>
                    </div>
                  )}
                  {form.errors.code ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.code}</p>
                  ) : null}
                </td>
              </tr>

              <tr>
                <th className="w-64 px-4 py-3 text-left align-top text-xs font-semibold text-foreground">
                  Slug URL
                </th>
                <td className="px-4 py-3">
                  <div className="flex max-w-md items-center rounded-md border border-border bg-surface px-3 shadow-xs focus-within:ring-1 focus-within:ring-ring">
                    <span className="font-mono text-xs text-muted-foreground shrink-0">
                      /products/
                    </span>
                    <input
                      id="cat-slug"
                      value={form.data.slug}
                      onChange={(e) => {
                        slugTouched.current = true
                        form.setData("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))
                      }}
                      placeholder={
                        form.data.name ? toSlug(form.data.name) : "otomatis-dari-nama"
                      }
                      className="w-full bg-transparent py-1.5 pl-1 font-mono text-xs text-foreground outline-none"
                    />
                  </div>
                  {form.errors.slug ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.slug}</p>
                  ) : null}
                </td>
              </tr>

              <tr>
                <th className="w-64 px-4 py-3 text-left align-top text-xs font-semibold text-foreground">
                  Status Kategori
                </th>
                <td className="px-4 py-3">
                  <CheckboxField
                    id="cat-is-active"
                    checked={form.data.is_active}
                    onChange={(checked) => form.setData("is_active", checked)}
                    label={
                      <span className="font-semibold text-foreground text-xs">
                        Kategori Aktif
                      </span>
                    }
                    standalone
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2. Produk Terkait (Hanya tampil saat mode Edit) */}
        {category ? (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Produk Terkait</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ringkasan produk yang tergabung di dalam kategori ini.
              </p>
            </div>
            <table className="w-full">
              <tbody className="divide-y divide-border">
                <tr>
                  <th className="w-64 px-4 py-3 text-left align-top text-xs font-semibold text-foreground">
                    Jumlah Produk Aktif
                  </th>
                  <td className="px-4 py-3">
                    <span className="text-base font-bold text-foreground tabular-nums">
                      {category.products_count ?? 0}
                    </span>{" "}
                    <span className="text-xs text-muted-foreground">produk terhubung</span>
                  </td>
                </tr>

                <tr>
                  <th className="w-64 px-4 py-3 text-left align-top text-xs font-semibold text-foreground">
                    Aksi Terkait
                  </th>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {category.products_url ? (
                        <Button asChild variant="outline" size="sm" className="text-xs">
                          <Link href={category.products_url}>
                            <Icon name="package" className="size-3.5 mr-1.5 text-muted-foreground" aria-hidden="true" />
                            Lihat produk di kategori ini
                          </Link>
                        </Button>
                      ) : null}

                      {category.public_url ? (
                        <Button asChild variant="ghost" size="sm" className="text-xs">
                          <a href={category.public_url} target="_blank" rel="noreferrer">
                            <Icon
                              name="arrow-up-right"
                              className="size-3.5 mr-1.5 text-muted-foreground"
                              aria-hidden="true"
                            />
                            Lihat di toko
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </form>
    </AdminLayout>
  )
}
