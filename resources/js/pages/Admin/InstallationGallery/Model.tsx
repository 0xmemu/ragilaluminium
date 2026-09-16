import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { MediaPicker } from "@/components/admin/media-picker"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Field } from "@/components/admin/ui/field"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"

interface MediaRow {
  id: number
  product_id: number
  label: string
  position: number
  status: string
  error_reason?: string | null
  media_kind: string
  thumb_url?: string | null
  media_url?: string | null
  update_url: string
  archive_url: string
  redownload_url: string
  destroy_url?: string | null
}

interface OwnerProduct {
  id: number
  parent_sku: string
  name: string
}

/**
 * Tingkat 2: kelola media hasil pemasangan satu model produk.
 * Tambah via MediaPicker (simpan instan), lepas via arsip instan.
 */
export default function InstallationGalleryModel({
  title,
  description,
  categorySlug,
  modelSlug,
  isManual = false,
  backUrl,
  products = [],
  mediaRows = [],
  mediaStoreUrl,
  pickerUrl,
}: {
  title: string
  description: string
  categorySlug: string
  modelSlug: string
  isManual?: boolean
  backUrl: string
  products?: OwnerProduct[]
  mediaRows?: MediaRow[]
  mediaStoreUrl?: string
  pickerUrl?: string
}) {
  const [rows, setRows] = React.useState(mediaRows)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [pickedMedia, setPickedMedia] = React.useState<
    Array<{ assetId: number; label: string; thumbUrl: string; kind: "image" | "video" }>
  >([])
  const [ownerProductId, setOwnerProductId] = React.useState<string>(
    products.length === 1 ? String(products[0].id) : "",
  )
  const [adding, setAdding] = React.useState(false)
  const actionForm = useForm({})

  React.useEffect(() => {
    setRows(mediaRows)
  }, [mediaRows])

  function addPicked() {
    if (!mediaStoreUrl) return
    const storeUrl = mediaStoreUrl.replace("{productId}", ownerProductId)
    if (!pickedMedia.length || !ownerProductId) return
    setAdding(true)
    pickedMedia.forEach((m, index) => {
      router.post(storeUrl, {
        media_asset_id: m.assetId,
        kind: m.kind,
        position: 100 + index + 1,
        is_main_image: false,
        show_in_catalog: false,
        is_installation: true,
        visibility: "visible",
      }, {
        preserveScroll: true,
        onFinish: () => {
          if (index === pickedMedia.length - 1) {
            setAdding(false)
            setPickedMedia([])
            setPickerOpen(false)
            router.reload({ only: ["mediaRows"] })
          }
        },
      })
    })
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap gap-2">
          {!isManual ? (
            <Button type="button" onClick={() => setPickerOpen(true)}>
              <Icon name="plus" className="size-4" aria-hidden="true" />
              Tambah media
            </Button>
          ) : null}
          <Button asChild variant="secondary">
            <Link href={backUrl}>
              <Icon name="arrow-left" className="size-4" aria-hidden="true" />
              Kembali
            </Link>
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      {rows.length ? (
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
          <div className="border-b border-border p-5">
            <h2 className="text-xl font-semibold">Media hasil pemasangan</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {rows.length} media. Tampil di seksi Hasil Pemasangan halaman produk dan galeri publik.
            </p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((row) => (
              <article key={row.id} className="overflow-hidden rounded-lg border border-border bg-surface">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/30">
                  {row.media_kind === "video" && row.media_url ? (
                    <video src={row.media_url} controls muted preload="metadata" className="size-full object-cover" />
                  ) : row.thumb_url ? (
                    <img src={row.thumb_url} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-muted-foreground">-</span>
                  )}
                  <span className="absolute left-2 top-2">
                    <StatusBadge status={row.status} />
                  </span>
                </div>
                <div className="space-y-1 p-3">
                  <p className="truncate text-xs font-semibold text-foreground" title={row.label}>
                    {row.label}
                  </p>
                  {row.status === "failed" && row.error_reason ? (
                    <p className="text-xs leading-4 text-destructive">{row.error_reason}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {row.status === "failed" || row.status === "pending" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => actionForm.post(row.redownload_url, { preserveScroll: true })}
                        disabled={actionForm.processing}
                      >
                        Unduh ulang
                      </Button>
                    ) : null}
                    {row.destroy_url ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="text-destructive"
                        onClick={() => router.delete(row.destroy_url!, { preserveScroll: true })}
                        disabled={actionForm.processing}
                      >
                        Hapus
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          title="Belum ada media hasil pemasangan"
          description={isManual ? "Kelola galeri manual melalui daftar di bawah." : "Tambahkan media lewat tombol Tambah media di atas."}
        />
      )}

      {!isManual && mediaStoreUrl && products.length ? (
        <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Tambah media cepat</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Pilih produk pemilik lalu pilih media dari Media Library. Tersimpan instan sebagai
            hasil pemasangan.
          </p>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={(event) => { event.preventDefault(); addPicked() }}
          >
            <Field id="ig-owner" label="Produk pemilik">
              <Select value={ownerProductId} onChange={(event) => setOwnerProductId(event.target.value)}>
                <option value="">- Pilih produk -</option>
                {products.map((product) => (
                  <option key={product.id} value={String(product.id)}>
                    {product.name} ({product.parent_sku})
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Button type="button" variant="secondary" onClick={() => setPickerOpen(true)} disabled={!ownerProductId}>
                <Icon name="plus" className="size-4" aria-hidden="true" />
                Pilih media
              </Button>
            </div>
          </form>
          {pickedMedia.length ? (
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs font-semibold text-foreground">{pickedMedia.length} media dipilih</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {pickedMedia.map((m) => (
                  <img key={m.assetId} src={m.thumbUrl} alt={m.label} className="h-12 w-12 rounded border border-border object-cover" />
                ))}
              </div>
              <Button type="button" size="sm" className="mt-3" onClick={addPicked} disabled={adding}>
                {adding ? "Menyimpan..." : `Simpan ${pickedMedia.length} media`}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <MediaPicker
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setPickedMedia([]) }}
        multiple
        title="Pilih media hasil pemasangan"
        onPick={setPickedMedia}
      />
    </AdminLayout>
  )
}
