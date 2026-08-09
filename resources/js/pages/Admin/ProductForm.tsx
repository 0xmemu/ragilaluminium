import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { SelectOption } from "@/types"

type WizardStep = "identity" | "variants" | "media" | "review"

interface VariantDraft {
  variation_1_name: string
  variation_1_option: string
  variation_2_name: string
  variation_2_option: string
  price: string
  stock: string
  weight_kg: string
  width_cm: string
  height_cm: string
  depth_cm: string
  status: string
}

interface VariantRecord extends VariantDraft {
  id: number
  variant_sku: string
}

interface ProductFormData {
  workflow: "wizard"
  wizard_step: WizardStep
  name: string
  short_name: string
  description: string
  category_id: number | string
  product_category: string
  product_model: string
  design_variant: string
  status: string
  homepage_popular: boolean
  homepage_popular_sort: number | string
}

interface ProductRecord extends Omit<ProductFormData, "workflow" | "wizard_step"> {
  id: number
  parent_sku: string
}

const steps: Array<{ key: WizardStep; label: string }> = [
  { key: "identity", label: "Identitas" },
  { key: "variants", label: "Varian & harga" },
  { key: "media", label: "Media" },
  { key: "review", label: "Review" },
]

function emptyVariant(): VariantDraft {
  return {
    variation_1_name: "Ukuran",
    variation_1_option: "",
    variation_2_name: "",
    variation_2_option: "",
    price: "",
    stock: "0",
    weight_kg: "",
    width_cm: "",
    height_cm: "",
    depth_cm: "",
    status: "active",
  }
}

export default function ProductForm({
  product,
  submitUrl,
  publishUrl,
  variantBulkUrl,
  mediaHref,
  wizardStep = "identity",
  variants = [],
  completion = { active_variants: 0, main_image_ready: false },
  options,
}: {
  product: ProductRecord | null
  submitUrl: string
  publishUrl?: string
  variantBulkUrl?: string
  mediaHref?: string
  wizardStep?: WizardStep
  variants?: VariantRecord[]
  completion?: { active_variants: number; main_image_ready: boolean }
  options: {
    categories: SelectOption[]
    models: SelectOption[]
    designs: Array<SelectOption & { model: string }>
    statuses: SelectOption[]
  }
}) {
  const editing = Boolean(product)
  const activeStep: WizardStep = editing ? wizardStep : "identity"
  const form = useForm<ProductFormData>({
    workflow: "wizard",
    wizard_step: editing ? wizardStep : "identity",
    name: product?.name ?? "",
    short_name: product?.short_name ?? "",
    description: product?.description ?? "",
    category_id: product?.category_id ?? "",
    product_category: product?.product_category ?? options.categories[0]?.value ?? "WINDOW",
    product_model: product?.product_model ?? options.models[0]?.value ?? "SLIDING",
    design_variant: product?.design_variant ?? options.designs[0]?.value ?? "POLOS",
    status: product?.status ?? "active",
    homepage_popular: product?.homepage_popular ?? false,
    homepage_popular_sort: product?.homepage_popular_sort ?? 0,
  })
  const variantsForm = useForm<{ wizard_step: WizardStep; variants: VariantDraft[] }>({
    wizard_step: "media",
    variants: [emptyVariant()],
  })
  const publishForm = useForm({})

  const currentIndex = steps.findIndex((step) => step.key === activeStep)

  React.useEffect(() => {
    if (!form.isDirty && !variantsForm.isDirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [form.isDirty, variantsForm.isDirty])

  function submitIdentity(status: "active" | "archived", event: React.FormEvent) {
    event.preventDefault()
    form.setData("status", status)
    form.setData("wizard_step", "variants")

    if (editing) {
      form.put(submitUrl)
    } else {
      form.post(submitUrl)
    }
  }

  function submitVariants(event: React.FormEvent) {
    event.preventDefault()
    if (!variantBulkUrl) return
    variantsForm.setData("wizard_step", "media")
    variantsForm.post(variantBulkUrl, { preserveScroll: true })
  }

  function updateVariant(index: number, key: keyof VariantDraft, value: string) {
    const next = variantsForm.data.variants.map((variant, variantIndex) =>
      variantIndex === index ? { ...variant, [key]: value } : variant,
    )
    variantsForm.setData("variants", next)
  }

  function goToStep(step: WizardStep) {
    if (!editing) return
    router.get(routeUrl("admin.products.edit", { product: product?.id, step }))
  }

  return (
    <AdminLayout
      title={editing ? "Edit produk" : "Tambah produk"}
      description={
        editing
          ? `Lengkapi ${product?.parent_sku} dari satu alur kerja.`
          : "Buat produk baru, tambahkan varian, lalu siapkan media. Produk langsung tampil saat aktif."
      }
      actions={
        <Button asChild variant="secondary">
          <Link href={routeUrl("admin.products.index")}>Keluar</Link>
        </Button>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Produk | Admin`} />

      <div className="mx-auto max-w-6xl space-y-6">
        <nav aria-label="Progress tambah produk" className="grid grid-cols-4 gap-2">
          {steps.map((step, index) => {
            const isActive = step.key === activeStep
            const isDone = index < currentIndex
            const disabled = !editing && index > 0

            return (
              <button
                key={step.key}
                type="button"
                disabled={disabled}
                onClick={() => goToStep(step.key)}
                className={`border-b-2 px-2 py-3 text-left text-xs transition-colors sm:px-4 sm:text-sm ${
                  isActive
                    ? "border-primary font-semibold text-foreground"
                    : isDone
                      ? "border-success text-foreground"
                      : "border-border text-muted-foreground"
                } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <span className="mr-1 tabular-nums">{index + 1}.</span>{step.label}
              </button>
            )
          })}
        </nav>

        <FormErrorSummary errors={form.errors} />
        <FormErrorSummary errors={variantsForm.errors} />
        <FormErrorSummary errors={publishForm.errors} />

        {activeStep === "identity" ? (
          <form onSubmit={submitIdentity} className="space-y-6">
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Identitas produk</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Informasi yang dipakai admin dan katalog publik.</p>
                </div>
                {product ? <StatusBadge status={product.status} /> : <StatusBadge status="active" label="Aktif (baru)" />}
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field id="product-parent-sku" label="Parent SKU">
                  <Input value={product?.parent_sku ?? "(otomatis saat disimpan)"} readOnly disabled className="font-mono" />
                </Field>
                <Field id="product-category-id" label="ID kategori Shopee" required error={form.errors.category_id}>
                  <Input
                    type="number"
                    min="1"
                    value={form.data.category_id}
                    onChange={(event) => form.setData("category_id", event.target.value)}
                  />
                </Field>
                <Field id="product-name" label="Nama produk" required error={form.errors.name} className="sm:col-span-2">
                  <Input value={form.data.name} onChange={(event) => form.setData("name", event.target.value)} />
                </Field>
                <Field id="product-short-name" label="Nama pendek" error={form.errors.short_name}>
                  <Input value={form.data.short_name} onChange={(event) => form.setData("short_name", event.target.value)} />
                </Field>
                <Field id="product-status" label="Status" hint="Produk baru langsung tampil di katalog (aktif). Arsipkan bila belum ingin dijual." error={form.errors.status}>
                  <Select value={form.data.status} onChange={(event) => form.setData("status", event.target.value)}>
                    {options.statuses.map((option) => (
                      <option key={option.value} value={option.value}>{option.label === "active" ? "Aktif" : "Diarsipkan"}</option>
                    ))}
                  </Select>
                </Field>
                <Field id="product-description" label="Deskripsi" error={form.errors.description} className="sm:col-span-2">
                  <Textarea rows={5} value={form.data.description} onChange={(event) => form.setData("description", event.target.value)} />
                </Field>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
              <h2 className="text-xl font-semibold">Taksonomi</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-3">
                <Field id="product-category" label="Kategori" required error={form.errors.product_category}>
                  <Select value={form.data.product_category} onChange={(event) => form.setData("product_category", event.target.value)}>
                    {options.categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                </Field>
                <Field id="product-model" label="Model" required error={form.errors.product_model}>
                  <Select value={form.data.product_model} onChange={(event) => form.setData("product_model", event.target.value)}>
                    {options.models.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                </Field>
                <Field id="product-design" label="Sub model" hint="Pilihan sub model aktif untuk model terpilih. Kosongkan bila tanpa sub model." error={form.errors.design_variant}>
                  <Select value={form.data.design_variant} onChange={(event) => form.setData("design_variant", event.target.value)}>
                    <option value="">Tanpa sub model</option>
                    {options.designs
                      .filter((option) => option.model === form.data.product_model)
                      .map((option) => (
                        <option key={option.model + ":" + option.value} value={option.value}>{option.label}</option>
                      ))}
                  </Select>
                </Field>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
              <h2 className="text-xl font-semibold">Beranda</h2>
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-md bg-surface-muted p-4">
                <input type="checkbox" checked={form.data.homepage_popular} onChange={(event) => form.setData("homepage_popular", event.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
                <span>
                  <span className="block text-sm font-semibold">Tampilkan sebagai paling banyak dipesan</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">Gunakan hanya untuk produk yang memang ingin diprioritaskan.</span>
                </span>
              </label>
              <Field id="product-popular-sort" label="Urutan tampilan" error={form.errors.homepage_popular_sort} className="mt-5 max-w-48">
                <Input type="number" min="0" max="9999" value={form.data.homepage_popular_sort} onChange={(event) => form.setData("homepage_popular_sort", event.target.value)} disabled={!form.data.homepage_popular} />
              </Field>
            </section>

            <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-6">
              <Button type="button" variant="secondary" disabled={form.processing} onClick={(event) => submitIdentity("archived", event)}>
                {form.processing ? "Menyimpan..." : "Simpan & Arsipkan"}
              </Button>
              <Button type="button" disabled={form.processing} onClick={(event) => submitIdentity("active", event)}>
                {form.processing ? "Menyimpan..." : "Simpan & Aktifkan"}
              </Button>
            </div>
          </form>
        ) : null}

        {activeStep === "variants" && product ? (
          <form onSubmit={submitVariants} className="space-y-6">
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border p-5 sm:p-7">
                <h2 className="text-xl font-semibold">Varian, harga, dan stok</h2>
                <p className="mt-1 text-sm text-muted-foreground">Tambahkan beberapa ukuran sekaligus. SKU dibuat otomatis.</p>
              </div>
              {variants.length ? (
                <div className="divide-y divide-border">
                  {variants.map((variant) => (
                    <div key={variant.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-7">
                      <div>
                        <p className="font-mono text-xs font-semibold">{variant.variant_sku}</p>
                        <p className="mt-1 text-sm">{[variant.variation_1_option, variant.variation_2_option].filter(Boolean).join(" / ") || "Tanpa label variasi"}</p>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span>{formatCurrency(Number(variant.price))}</span>
                        <span className="text-muted-foreground">Stok {variant.stock}</span>
                        <StatusBadge status={variant.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-7 text-sm text-muted-foreground">Belum ada varian. Isi baris pertama di bawah.</p>
              )}
            </section>

            <section className="space-y-5">
              {variantsForm.data.variants.map((variant, index) => (
                <article key={index} className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-semibold">Varian baru {index + 1}</h2>
                    {variantsForm.data.variants.length > 1 ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => variantsForm.setData("variants", variantsForm.data.variants.filter((_, rowIndex) => rowIndex !== index))}>Hapus baris</Button>
                    ) : null}
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {([
                      ["variation_1_name", "Nama opsi 1"],
                      ["variation_1_option", "Nilai opsi 1"],
                      ["variation_2_name", "Nama opsi 2"],
                      ["variation_2_option", "Nilai opsi 2"],
                      ["price", "Harga"],
                      ["stock", "Stok"],
                      ["weight_kg", "Berat (kg)"],
                      ["width_cm", "Lebar (cm)"],
                      ["height_cm", "Tinggi (cm)"],
                      ["depth_cm", "Tebal (cm)"],
                    ] as Array<[keyof VariantDraft, string]>).map(([key, label]) => (
                      <Field key={key} id={`wizard-variant-${index}-${key}`} label={label} error={variantsForm.errors[`variants.${index}.${key}`]}>
                        <Input type={key === "price" || key.includes("_cm") || key === "stock" ? "number" : "text"} min={key === "price" || key === "stock" || key.includes("_cm") ? "0" : undefined} step={key === "price" || key === "stock" ? "1" : "0.01"} value={variant[key]} onChange={(event) => updateVariant(index, key, event.target.value)} />
                      </Field>
                    ))}
                  </div>
                </article>
              ))}
              <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-6">
                <Button type="button" variant="secondary" onClick={() => variantsForm.setData("variants", [...variantsForm.data.variants, emptyVariant()])}>Tambah baris varian</Button>
                <Button type="submit" disabled={variantsForm.processing || !variantBulkUrl}>{variantsForm.processing ? "Menyimpan..." : "Simpan varian & lanjut ke media"}</Button>
              </div>
            </section>
          </form>
        ) : null}

        {activeStep === "media" && product ? (
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-semibold">Media produk</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Pasang gambar produk, atur gambar utama, dan tandai hasil pemasangan. Media Library bersama akan tersedia di selector ini.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface-muted p-4">
                <p className="text-xs text-muted-foreground">Status gambar utama</p>
                <p className="mt-2 text-sm font-semibold">{completion.main_image_ready ? "Siap digunakan" : "Belum ada gambar utama siap"}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-muted p-4">
                <p className="text-xs text-muted-foreground">Varian aktif</p>
                <p className="mt-2 text-sm font-semibold tabular-nums">{completion.active_variants}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {mediaHref ? <Button asChild><Link href={mediaHref}>Kelola media produk</Link></Button> : null}
              <Button asChild variant="secondary"><Link href={routeUrl("admin.products.edit", { product: product.id, step: "review" })}>Lanjut ke review</Link></Button>
            </div>
          </section>
        ) : null}

        {activeStep === "review" && product ? (
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-semibold">Review sebelum publish</h2>
            <p className="mt-2 text-sm text-muted-foreground">Periksa blocker berikut. Draft tetap dapat disimpan tanpa publish.</p>
            <div className="mt-6 space-y-3">
              <ReviewRow label="Identitas produk" ready={Boolean(product.name)} />
              <ReviewRow label="Minimal satu varian aktif" ready={completion.active_variants > 0} detail={`${completion.active_variants} varian aktif`} />
              <ReviewRow label="Gambar utama katalog sudah siap" ready={completion.main_image_ready} />
            </div>
            <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-border pt-6">
              <Button asChild variant="secondary"><Link href={routeUrl("admin.products.edit", { product: product.id, step: "media" })}>Kembali ke media</Link></Button>
              {publishUrl ? <Button type="button" disabled={publishForm.processing} onClick={() => publishForm.post(publishUrl)}>{publishForm.processing ? "Mempublikasikan..." : "Simpan & publikasikan"}</Button> : null}
            </div>
          </section>
        ) : null}
      </div>
    </AdminLayout>
  )
}

function ReviewRow({ label, ready, detail }: { label: string; ready: boolean; detail?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-b-0">
      <span className="text-sm">{label}</span>
      <span className={`text-sm font-semibold ${ready ? "text-success" : "text-warning"}`}>{ready ? "Siap" : "Perlu dilengkapi"}{detail ? ` · ${detail}` : ""}</span>
    </div>
  )
}
