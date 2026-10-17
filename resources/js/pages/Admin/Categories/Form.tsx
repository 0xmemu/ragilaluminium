import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { Field, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
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

function toSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export default function CategoryForm({
  title,
  description,
  category,
  submitUrl,
  backUrl,
}: Props) {
  const form = useForm({
    code: category?.code ?? "",
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    // Kategori baru langsung aktif. Menonaktifkan dilakukan dari daftar kategori.
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

        <SectionCard
          title="Identitas Kategori"
          description="Informasi dasar, penamaan, dan struktur URL untuk kategori di katalog website."
        >
          <FieldGrid>
            <Field
              id="cat-name"
              label="Nama Kategori"
              required
              error={form.errors.name}
              hint="Nama resmi yang tampil di menu navigasi toko."
              className="sm:col-span-2"
            >
              <Input
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
              />
            </Field>

            <Field
              id="cat-code"
              label="Kode Kategori"
              error={form.errors.code}
              hint={
                category
                  ? (category.products_count ?? 0) > 0
                    ? `Terkunci karena sudah dipakai ${category.products_count} produk. Menjadi awalan SKU produk di dalamnya.`
                    : "Kode identifikasi internal kategori di sistem."
                  : "Dibuat otomatis dari nama saat disimpan."
              }
            >
              <p className="flex h-9 items-center font-mono text-xs font-semibold text-foreground">
                {category
                  ? form.data.code
                  : form.data.name
                    ? form.data.name
                        .toUpperCase()
                        .replace(/[^A-Z0-9]+/g, "_")
                        .replace(/^_+|_+$/g, "")
                    : "(otomatis dari nama)"}
              </p>
            </Field>

            <Field
              id="cat-slug"
              label="Slug URL"
              error={form.errors.slug}
              hint="Alamat halaman kategori di toko. Dibuat otomatis dari nama bila dikosongkan."
            >
              <div className="flex items-center rounded-md border border-input bg-surface px-3 shadow-xs transition duration-150 ease-standard focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  /products/
                </span>
                <input
                  value={form.data.slug}
                  onChange={(e) => {
                    slugTouched.current = true
                    form.setData("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))
                  }}
                  placeholder={form.data.name ? toSlug(form.data.name) : "otomatis-dari-nama"}
                  className="w-full bg-transparent py-2 pl-1 font-mono text-xs text-foreground outline-none"
                />
              </div>
            </Field>

          </FieldGrid>
        </SectionCard>

        {category ? (
          <SectionCard
            title="Produk Terkait"
            description="Ringkasan produk yang tergabung di dalam kategori ini."
          >
            <FieldGrid>
              <Field id="cat-product-count" label="Jumlah Produk Aktif">
                <p className="flex h-9 items-center gap-1.5 text-sm text-foreground">
                  <span className="font-bold tabular-nums">{category.products_count ?? 0}</span>
                  <span className="text-xs text-muted-foreground">produk terhubung</span>
                </p>
              </Field>
              <Field id="cat-related-actions" label="Aksi Terkait">
                <div className="flex min-h-9 flex-wrap items-center gap-2">
                  {category.products_url ? (
                    <Button asChild variant="outline" size="sm" className="text-xs">
                      <Link href={category.products_url}>
                        <Icon name="package" className="mr-1.5 size-3.5 text-muted-foreground" aria-hidden="true" />
                        Lihat produk di kategori ini
                      </Link>
                    </Button>
                  ) : null}
                  {category.public_url ? (
                    <Button asChild variant="ghost" size="sm" className="text-xs">
                      <a href={category.public_url} target="_blank" rel="noreferrer">
                        <Icon
                          name="arrow-up-right"
                          className="mr-1.5 size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        Lihat di toko
                      </a>
                    </Button>
                  ) : null}
                </div>
              </Field>
            </FieldGrid>
          </SectionCard>
        ) : null}
      </form>
    </AdminLayout>
  )
}
