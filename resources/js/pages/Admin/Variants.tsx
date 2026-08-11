import { Head, Link, useForm } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { StatusSelect } from "@/components/admin/ui/status-select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency } from "@/lib/format"
import { routeUrl } from "@/lib/routes"

const VARIANT_STATUSES = ["active", "inactive", "archived"] as const

interface VariantRow {
  id: number
  variant_sku: string
  variation_1_option?: string | null
  variation_2_option?: string | null
  price: number
  stock: number
  status: string
  media_count?: number
  editUrl: string
  archiveUrl: string
  mediaUrl?: string
}

export default function Variants({
  product,
  variants = [],
  submitUrl,
}: {
  product: { id: number; name: string; parent_sku: string; media_href?: string }
  variants: VariantRow[]
  submitUrl: string
}) {
  const form = useForm({
    variation_1_name: "",
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
  })
  const archiveForm = useForm({})

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.post(submitUrl, {
      preserveScroll: true,
      onSuccess: () => form.reset(),
    })
  }

  return (
    <AdminLayout
      title={`Varian ${product.parent_sku}`}
      description={product.name}
      actions={
        <div className="flex flex-wrap gap-2">
          {product.media_href ? (
            <Button asChild variant="secondary">
              <Link href={product.media_href}>
                <Icon name="image" className="h-4 w-4" aria-hidden="true" />
                Kelola media
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="secondary">
            <Link href={routeUrl("admin.products.show", { product: product.id })}>Kembali ke produk</Link>
          </Button>
        </div>
      }
    >
      <Head title={`Varian ${product.parent_sku} | Admin`} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div className="border-b border-border p-5">
            <h2 className="text-xl font-semibold">Daftar varian</h2>
            <p className="mt-1 text-xs text-muted-foreground">{variants.length} varian tercatat.</p>
          </div>
          {variants.length ? (
            <div className="divide-y divide-border">
              {variants.map((variant) => (
                <article key={variant.id} className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-xs font-semibold">{variant.variant_sku}</p>
                      <StatusBadge status={variant.status} />
                    </div>
                    <p className="mt-2 text-sm font-semibold">
                      {[variant.variation_1_option, variant.variation_2_option].filter(Boolean).join(" / ") ||
                        "Tanpa label variasi"}
                    </p>
                    <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                      <span className="tabular-nums">{formatCurrency(variant.price)}</span>
                      <span className="tabular-nums">Stok {variant.stock}</span>
                      <span className="tabular-nums">{variant.media_count ?? 0} foto</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {variant.mediaUrl ? (
                      <Button asChild variant="secondary" size="sm">
                        <Link href={variant.mediaUrl}>
                          <Icon name="image" className="h-4 w-4" aria-hidden="true" />
                          Foto
                        </Link>
                      </Button>
                    ) : null}
                    <Button asChild variant="secondary" size="sm">
                      <Link href={variant.editUrl}>
                        <Icon name="pencil" className="h-4 w-4" aria-hidden="true" />
                        Edit
                      </Link>
                    </Button>
                    {variant.status !== "archived" ? (
                      <ConfirmAction
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Arsipkan ${variant.variant_sku}`}>
                            <Icon name="archive" className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        }
                        title="Arsipkan varian?"
                        description={`${variant.variant_sku} tidak dihapus, tetapi tidak lagi aktif.`}
                        confirmLabel="Arsipkan"
                        processing={archiveForm.processing}
                        onConfirm={() => archiveForm.post(variant.archiveUrl, { preserveScroll: true })}
                      />
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="p-8 text-sm text-muted-foreground">Belum ada varian.</p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm xl:sticky xl:top-24">
          <h2 className="text-xl font-semibold">Tambah varian</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            SKU varian dibuat otomatis (mengikuti prefix parent: WEB… atau SP…). Harga, stok, dan status wajib diisi.
          </p>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <FormErrorSummary errors={form.errors} />
            <div className="grid sm:grid-cols-2 gap-3">
              <Field id="variant-name-1" label="Nama opsi 1" error={form.errors.variation_1_name}>
                <Input value={form.data.variation_1_name} onChange={(event) => form.setData("variation_1_name", event.target.value)} />
              </Field>
              <Field id="variant-option-1" label="Nilai opsi 1" error={form.errors.variation_1_option}>
                <Input value={form.data.variation_1_option} onChange={(event) => form.setData("variation_1_option", event.target.value)} />
              </Field>
              <Field id="variant-name-2" label="Nama opsi 2" error={form.errors.variation_2_name}>
                <Input value={form.data.variation_2_name} onChange={(event) => form.setData("variation_2_name", event.target.value)} />
              </Field>
              <Field id="variant-option-2" label="Nilai opsi 2" error={form.errors.variation_2_option}>
                <Input value={form.data.variation_2_option} onChange={(event) => form.setData("variation_2_option", event.target.value)} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field id="variant-price" label="Harga" required error={form.errors.price}>
                <Input type="number" min="0" value={form.data.price} onChange={(event) => form.setData("price", event.target.value)} />
              </Field>
              <Field id="variant-stock" label="Stok" required error={form.errors.stock}>
                <Input type="number" min="0" value={form.data.stock} onChange={(event) => form.setData("stock", event.target.value)} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                ["weight_kg", "Berat (kg)"],
                ["width_cm", "Lebar (cm)"],
                ["height_cm", "Tinggi (cm)"],
                ["depth_cm", "Tebal (cm)"],
              ].map(([key, label]) => (
                <Field key={key} id={`variant-${key}`} label={label} error={form.errors[key as keyof typeof form.errors]}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.data[key as keyof typeof form.data] as string}
                    onChange={(event) => form.setData(key as keyof typeof form.data, event.target.value)}
                  />
                </Field>
              ))}
            </div>
            <Field id="variant-status" label="Status" required error={form.errors.status}>
              <StatusSelect statuses={VARIANT_STATUSES} value={form.data.status} onChange={(event) => form.setData("status", event.target.value)} />
            </Field>
            <Button type="submit" className="w-full" disabled={form.processing}>
              {form.processing ? "Menyimpan..." : "Tambah varian"}
            </Button>
          </form>
        </section>
      </div>
    </AdminLayout>
  )
}
