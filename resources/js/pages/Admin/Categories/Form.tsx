import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { Icon } from "@/components/shared/icon"

interface CategoryData {
  id?: number
  code: string
  name: string
  slug: string
  seo_title?: string | null
  seo_description?: string | null
  sort_order: number
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
  submitUrl: string
}

export default function CategoryForm({ title, description, category, submitUrl, backUrl }: Props) {
  const form = useForm({
    code: category?.code ?? "",
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    seo_title: category?.seo_title ?? "",
    seo_description: category?.seo_description ?? "",
    sort_order: category?.sort_order ?? 0,
    is_active: category?.is_active ?? true,
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
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
          <Button type="submit" form="category-form" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : category ? "Simpan" : "Tambah"}
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <form id="category-form" onSubmit={submit} className="w-full space-y-6">
        <FormErrorSummary errors={form.errors} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          {/* Kolom Kiri / Form Utama */}
          <div className="space-y-6 min-w-0">
            {/* 1. Identitas Kategori */}
            <Card className="overflow-hidden border border-border bg-card p-5 sm:p-6 shadow-sm">
              <div className="border-b border-border/70 pb-4 mb-5">
                <h2 className="text-base font-bold text-foreground">Identitas Kategori</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Informasi dasar, penamaan, dan struktur URL untuk kategori di katalog website.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="cat-name"
                  label="Nama Kategori"
                  required
                  error={form.errors.name}
                  hint="Nama resmi yang tampil di menu navigasi toko."
                >
                  <Input
                    id="cat-name"
                    value={form.data.name}
                    onChange={(e) => {
                      const name = e.target.value
                      form.setData((prev) => ({
                        ...prev,
                        name,
                        ...(!category && !prev.slug
                          ? { slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }
                          : {}),
                      }))
                    }}
                    placeholder="contoh: Jendela Aluminium"
                    required
                  />
                </Field>

                <Field
                  id="cat-code"
                  label="Kode Kategori"
                  hint={
                    category
                      ? (category.products_count ?? 0) > 0
                        ? "Kode terkunci karena sudah dipakai " + (category.products_count ?? 0) + " produk. Kode ini dipakai sebagai penanda kategori di katalog."
                        : "Kode identifikasi internal kategori di sistem."
                      : "Dihasilkan otomatis oleh sistem dari nama kategori (tidak perlu diisi manual)."
                  }
                >
                  <Input
                    id="cat-code"
                    value={
                      category
                        ? form.data.code
                        : form.data.name
                        ? form.data.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")
                        : "(otomatis dibuat oleh sistem)"
                    }
                    readOnly
                    disabled
                    className="font-mono bg-muted text-muted-foreground cursor-not-allowed"
                  />
                </Field>

                <Field
                  id="cat-slug"
                  label="Slug URL"
                  error={form.errors.slug}
                  hint="Alamat link publik toko: /products/{slug}. Otomatis dibuat jika dikosongkan."
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                      /products/
                    </span>
                    <Input
                      id="cat-slug"
                      value={form.data.slug}
                      onChange={(e) =>
                        form.setData("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))
                      }
                      placeholder={
                        form.data.name
                          ? form.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
                          : "otomatis-dari-nama"
                      }
                      className="pl-22 font-mono text-xs"
                    />
                  </div>
                </Field>

                <Field
                  id="cat-order"
                  label="Urutan Tampil"
                  error={form.errors.sort_order}
                  hint="Angka urutan prioritas di menu katalog (makin kecil makin depan)."
                >
                  <Input
                    id="cat-order"
                    type="number"
                    min={0}
                    value={form.data.sort_order}
                    onChange={(e) => form.setData("sort_order", Number(e.target.value))}
                    placeholder="0"
                  />
                </Field>
              </div>
            </Card>

            {/* 2. SEO & Meta Search */}
            <Card className="overflow-hidden border border-border bg-card p-5 sm:p-6 shadow-sm">
              <div className="border-b border-border/70 pb-4 mb-5">
                <h2 className="text-base font-bold text-foreground">Optimasi Mesin Pencari (SEO)</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Kelola bagaimana halaman kategori ini tampil di hasil pencarian Google.
                </p>
              </div>

              <div className="space-y-4">
                <Field
                  id="cat-seo-title"
                  label="SEO Meta Title"
                  error={form.errors.seo_title}
                  hint="Judul yang dibaca bot mesin pencari (direkomendasikan 50–60 karakter)."
                >
                  <Input
                    id="cat-seo-title"
                    value={form.data.seo_title}
                    onChange={(e) => form.setData("seo_title", e.target.value)}
                    placeholder={
                      form.data.name
                        ? `${form.data.name} Terbaik | Ragil Aluminium`
                        : "Judul halaman kategori untuk SEO"
                    }
                    maxLength={100}
                  />
                </Field>

                <Field
                  id="cat-seo-desc"
                  label="SEO Meta Description"
                  error={form.errors.seo_description}
                  hint="Ringkasan isi kategori yang muncul di cuplikan Google (direkomendasikan 120–160 karakter)."
                >
                  <Textarea
                    id="cat-seo-desc"
                    rows={3}
                    value={form.data.seo_description}
                    onChange={(e) => form.setData("seo_description", e.target.value)}
                    placeholder="Deskripsi singkat mengenai produk-produk di kategori ini..."
                    maxLength={300}
                  />
                </Field>

                {/* Pratinjau SERP Google */}
                <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    Pratinjau Hasil Pencarian Google
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate font-mono">
                    https://ragilaluminium.com/products/{form.data.slug || "kategori"}
                  </p>
                  <p className="text-sm font-semibold text-primary truncate hover:underline cursor-pointer">
                    {form.data.seo_title || form.data.name || "Kategori Produk"} · Ragil Aluminium
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {form.data.seo_description ||
                      "Jual produk aluminium berkualitas tinggi langsung dari workshop Ragil Aluminium. Bergaransi resmi dan pengiriman aman ke seluruh Indonesia."}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Kolom Kanan / Sidebar Info & Status */}
          <aside className="space-y-6 xl:sticky xl:top-24">
            {/* Status Card */}
            <Card className="p-5 border border-border bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-3">
                <h3 className="text-sm font-bold text-foreground">Status Kategori</h3>
                <StatusBadge status={form.data.is_active ? "active" : "inactive"} />
              </div>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.data.is_active}
                  onChange={(e) => form.setData("is_active", e.target.checked)}
                  className="mt-0.5 size-4 rounded border-border text-primary accent-primary"
                />
                <div className="text-xs leading-5">
                  <span className="font-semibold text-foreground">Kategori Aktif</span>
                  <p className="text-muted-foreground">
                    Bila dinonaktifkan, kategori disembunyikan dari navigasi toko dan katalog publik.
                  </p>
                </div>
              </label>

              <div className="pt-2 border-t border-border/60 flex flex-col gap-2">
                <Button type="submit" form="category-form" disabled={form.processing} className="w-full">
                  {form.processing
                    ? "Menyimpan..."
                    : category
                    ? "Simpan Perubahan"
                    : "Simpan Kategori"}
                </Button>
                <Button asChild variant="secondary" className="w-full">
                  <Link href={backUrl}>Kembali ke Kategori</Link>
                </Button>
              </div>
            </Card>

            {/* Hubungan Produk & Link Eksternal */}
            {category ? (
              <Card className="p-5 border border-border bg-card shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-foreground">Produk Terkait</h3>
                <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
                  <p className="text-muted-foreground">Jumlah produk aktif:</p>
                  <p className="text-lg font-bold text-foreground tabular-nums">
                    {category.products_count ?? 0}{" "}
                    <span className="text-xs font-normal text-muted-foreground">produk</span>
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  {category.products_url ? (
                    <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
                      <Link href={category.products_url}>
                        <Icon name="package" className="size-3.5 mr-1.5 text-muted-foreground" aria-hidden="true" />
                        Lihat produk di kategori ini
                      </Link>
                    </Button>
                  ) : null}

                  {category.public_url ? (
                    <Button asChild variant="ghost" size="sm" className="w-full justify-start text-xs">
                      <a href={category.public_url} target="_blank" rel="noreferrer">
                        <Icon
                          name="arrow-up-right"
                          className="size-3.5 mr-1.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        Buka halaman publik
                      </a>
                    </Button>
                  ) : null}
                </div>
              </Card>
            ) : null}
          </aside>
        </div>
      </form>
    </AdminLayout>
  )
}
