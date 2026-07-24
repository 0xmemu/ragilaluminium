import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { ConfirmAction } from "@/components/ui/confirm-action"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { StatusSelect } from "@/components/ui/status-select"
import { StatusBadge } from "@/components/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"

const VARIANT_STATUSES = ["active", "inactive", "archived"] as const

interface VariantEditData {
  variation_1_name: string
  variation_1_option: string
  variation_2_name: string
  variation_2_option: string
  price: number | string
  stock: number | string
  weight_kg: number | string
  width_cm: number | string
  height_cm: number | string
  depth_cm: number | string
  status: string
}

interface MediaItem {
  id: number
  position: number
  visibility: string
  status: string
  is_main_image: boolean
  thumb_url?: string | null
  update_url: string
  set_main_url: string
  archive_url: string
}

export default function VariantEdit({
  variant,
  media = [],
  mediaStoreUrl,
  mediaManageUrl,
  submitUrl,
  backUrl,
}: {
  variant: VariantEditData & { id: number; product_id: number; variant_sku: string }
  media?: MediaItem[]
  mediaStoreUrl: string
  mediaManageUrl: string
  submitUrl: string
  backUrl: string
}) {
  const form = useForm<VariantEditData>({
    variation_1_name: variant.variation_1_name ?? "",
    variation_1_option: variant.variation_1_option ?? "",
    variation_2_name: variant.variation_2_name ?? "",
    variation_2_option: variant.variation_2_option ?? "",
    price: variant.price,
    stock: variant.stock,
    weight_kg: variant.weight_kg ?? "",
    width_cm: variant.width_cm ?? "",
    height_cm: variant.height_cm ?? "",
    depth_cm: variant.depth_cm ?? "",
    status: variant.status,
  })
  const mediaForm = useForm<{
    source_url: string
    position: number
    is_main_image: boolean
    visibility: string
    product_variant_id: number
    upload: File | null
  }>({
    source_url: "",
    position: Math.min(9, (media?.length ?? 0) + 1),
    is_main_image: false,
    visibility: "visible",
    product_variant_id: variant.id,
    upload: null,
  })
  const actionForm = useForm({})

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.put(submitUrl)
  }

  return (
    <AdminLayout
      title="Edit varian"
      description={`${variant.variant_sku} — atur opsi, harga, dan foto khusus kombinasi ini.`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={mediaManageUrl}>
              <Icon name="image" className="h-4 w-4" aria-hidden="true" />
              Semua media produk
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={backUrl}>Batal</Link>
          </Button>
        </div>
      }
    >
      <Head title={`Edit ${variant.variant_sku} | Admin`} />
      <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6">
        <FormErrorSummary errors={form.errors} />
        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-semibold">Identitas dan opsi</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field
              id="edit-variant-sku"
              label="Variant SKU"
              hint="Dibuat otomatis; tidak dapat diubah."
              className="sm:col-span-2"
            >
              <Input value={variant.variant_sku} readOnly disabled className="font-mono" />
            </Field>
            {[
              ["variation_1_name", "Nama opsi 1"],
              ["variation_1_option", "Nilai opsi 1"],
              ["variation_2_name", "Nama opsi 2"],
              ["variation_2_option", "Nilai opsi 2"],
            ].map(([key, label]) => (
              <Field key={key} id={`edit-${key}`} label={label} error={form.errors[key as keyof VariantEditData]}>
                <Input
                  value={form.data[key as keyof VariantEditData] as string}
                  onChange={(event) => form.setData(key as keyof VariantEditData, event.target.value)}
                />
              </Field>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-semibold">Harga, stok, dan dimensi</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {[
              ["price", "Harga", true],
              ["stock", "Stok", true],
              ["weight_kg", "Berat (kg)", false],
              ["width_cm", "Lebar (cm)", false],
              ["height_cm", "Tinggi (cm)", false],
              ["depth_cm", "Tebal (cm)", false],
            ].map(([key, label, required]) => (
              <Field
                key={String(key)}
                id={`edit-${key}`}
                label={String(label)}
                required={Boolean(required)}
                error={form.errors[key as keyof VariantEditData]}
              >
                <Input
                  type="number"
                  min="0"
                  step={key === "stock" ? "1" : "0.01"}
                  value={form.data[key as keyof VariantEditData] as string | number}
                  onChange={(event) => form.setData(key as keyof VariantEditData, event.target.value)}
                />
              </Field>
            ))}
            <Field id="edit-variant-status" label="Status" required error={form.errors.status} className="sm:col-span-2">
              <StatusSelect statuses={VARIANT_STATUSES} value={form.data.status} onChange={(event) => form.setData("status", event.target.value)} />
            </Field>
          </div>
        </section>
        <div className="flex justify-end gap-2">
          <Button asChild variant="secondary"><Link href={backUrl}>Batal</Link></Button>
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan varian"}
          </Button>
        </div>
      </form>

      <section className="mx-auto mt-8 max-w-3xl space-y-4">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-semibold">Foto khusus varian ini</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gambar di sini hanya tampil di toko saat pelanggan memilih kombinasi opsi ini (mis. warna + kaca).
          </p>

          {media.length ? (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {media.map((item) => (
                <li key={item.id} className="overflow-hidden rounded-md border border-border">
                  {item.thumb_url ? (
                    <img src={item.thumb_url} alt="" className="aspect-[4/5] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[4/5] items-center justify-center bg-muted/40 text-xs text-muted-foreground">
                      Belum ada preview
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
                    <StatusBadge status={item.visibility} />
                    <span className="text-xs text-muted-foreground">Posisi {item.position}</span>
                    {item.is_main_image ? <StatusBadge status="active" label="Utama" /> : null}
                    {!item.is_main_image ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => actionForm.post(item.set_main_url, { preserveScroll: true })}
                        disabled={actionForm.processing}
                      >
                        Jadikan utama
                      </Button>
                    ) : null}
                    {item.visibility !== "archived" ? (
                      <ConfirmAction
                        trigger={<Button variant="ghost" size="xs">Arsipkan</Button>}
                        title="Arsipkan foto?"
                        description={`Media #${item.id} disembunyikan dari storefront.`}
                        confirmLabel="Arsipkan"
                        processing={actionForm.processing}
                        onConfirm={() => actionForm.post(item.archive_url, { preserveScroll: true })}
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Belum ada foto untuk varian ini. Unggah di bawah atau lewat halaman media produk.
            </p>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            mediaForm.post(mediaStoreUrl, {
              forceFormData: true,
              preserveScroll: true,
              onSuccess: () => {
                mediaForm.reset("source_url", "upload", "is_main_image")
                mediaForm.setData("product_variant_id", variant.id)
              },
            })
          }}
          className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7"
        >
          <h3 className="text-base font-semibold">Tambah foto untuk {variant.variant_sku}</h3>
          <FormErrorSummary errors={mediaForm.errors} className="mt-3" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="variant-media-upload" label="File gambar" error={mediaForm.errors.upload} className="sm:col-span-2">
              <Input
                type="file"
                accept="image/*"
                onChange={(event) => mediaForm.setData("upload", event.target.files?.[0] ?? null)}
              />
            </Field>
            <Field id="variant-media-url" label="URL sumber" error={mediaForm.errors.source_url} className="sm:col-span-2">
              <Input
                type="url"
                value={mediaForm.data.source_url}
                onChange={(event) => mediaForm.setData("source_url", event.target.value)}
              />
            </Field>
            <Field id="variant-media-position" label="Posisi" required error={mediaForm.errors.position}>
              <Input
                type="number"
                min="1"
                max="9"
                value={mediaForm.data.position}
                onChange={(event) => mediaForm.setData("position", Number(event.target.value))}
              />
            </Field>
            <Field id="variant-media-visibility" label="Visibilitas" required error={mediaForm.errors.visibility}>
              <StatusSelect
                statuses={["visible", "hidden", "archived"] as const}
                value={mediaForm.data.visibility}
                onChange={(event) => mediaForm.setData("visibility", event.target.value)}
              />
            </Field>
          </div>
          <Button
            type="submit"
            className="mt-5"
            disabled={mediaForm.processing || (!mediaForm.data.upload && !mediaForm.data.source_url)}
          >
            <Icon name="upload" className="h-4 w-4" aria-hidden="true" />
            {mediaForm.processing ? "Mengunggah..." : "Tambah foto varian"}
          </Button>
        </form>
      </section>
    </AdminLayout>
  )
}
