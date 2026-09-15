
import { Link, useForm } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { formatCurrency } from "@/lib/format"

const VARIANT_STATUSES = ["active", "inactive", "archived"] as const

export interface VariantDetail {
  id: number
  variant_sku: string
  variation_1_option?: string | null
  variation_2_option?: string | null
  price: number
  stock: number
  status: string
  media_count?: number
  update_url: string
  archive_url: string
  edit_url: string
}

/**
 * Daftar varian dengan arsip instan per varian + form tambah varian.
 * Ekstraksi dari halaman Variants (penggabungan e2e).
 */
export function VariantRowsPanel({
  variants,
  storeUrl,
}: {
  variants: VariantDetail[]
  storeUrl: string
}) {
  const archiveForm = useForm({})
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

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.post(storeUrl, {
      preserveScroll: true,
      onSuccess: () => form.reset(),
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="border-b border-border p-5">
          <h2 className="text-xl font-semibold">Daftar varian</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Harga dan stok diatur di matriks kombinasi di atas (tersimpan via tombol Simpan).
            {variants.length} varian tercatat.
          </p>
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
                    {[variant.variation_1_option, variant.variation_2_option].filter(Boolean).join(" - ") ||
                      "Tanpa label variasi"}
                  </p>
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    <span className="tabular-nums">{formatCurrency(variant.price)}</span>
                    <span className="tabular-nums">Stok {variant.stock}</span>
                    <span className="tabular-nums">{variant.media_count ?? 0} foto</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={variant.edit_url}>
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
                      onConfirm={() => archiveForm.post(variant.archive_url, { preserveScroll: true })}
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

    </div>
  )
}
