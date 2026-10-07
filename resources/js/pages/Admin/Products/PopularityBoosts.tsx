import { Head, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { formatNumber } from "@/lib/format"

interface ProductOption {
  id: number
  label: string
}

interface BoostRow {
  id: number
  enabled: boolean
  source: ProductOption | null
  target: ProductOption | null
  seed_sold_count: number
  source_sold_count: number
  target_sold_count: number
  effective_score: number
  notification_threshold: number | null
  threshold_notified_at: string | null
  disabled_at: string | null
  disabled_reason: string | null
  updated_at: string | null
  disable_url: string
  enable_url: string
}

function dateLabel(value: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export default function PopularityBoosts({
  title,
  description,
  boosts,
  products,
  storeUrl,
}: {
  title: string
  description: string
  boosts: BoostRow[]
  products: ProductOption[]
  storeUrl: string
}) {
  const form = useForm({
    source_product_id: "",
    target_product_id: "",
    notification_threshold: "",
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.post(storeUrl, {
      preserveScroll: true,
      onSuccess: () => form.reset(),
    })
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" form="boost-create-form" size="sm" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Aktifkan"}
          </Button>
        </div>
      }
    >
      <Head title={title + " | Admin"} />

      <div className="space-y-4">
        <ListToolbar
          search={{
            value: q,
            onChange: setQ,
            onSubmit: submitSearch,
            placeholder: "Cari SKU atau nama produk sumber/target...",
          }}
        >
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              visit({ q, status: event.target.value })
            }}
            aria-label="Filter status"
            className="w-36"
          >
            <option value="all">Semua status</option>
            <option value="active">Aktif</option>
            <option value="disabled">Nonaktif</option>
          </Select>
        </ListToolbar>

        <SectionCard
          title="Produk dengan Teruskan Popularitas"
          description={`${formatNumber(summary.active)} aktif dari ${formatNumber(summary.total)} konfigurasi. Setiap tindakan tercatat di Log Aktivitas.`}
          icon="trending-up"
          contentClassName="p-0"
        >
          {boosts.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon="trending-up"
                title={filters.q || filters.status !== "all" ? "Tidak ada hasil" : "Belum ada konfigurasi popularitas"}
                description={filters.q || filters.status !== "all"
                  ? "Sesuaikan pencarian atau filter status."
                  : "Gunakan tombol Tambah untuk memasangkan produk sumber ke produk target."}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] font-medium tracking-wide text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium" title="Pasangan produk asal dan produk penerima popularitas">Sumber ke Target</th>
                    <th className="px-3 py-2.5 text-right font-medium" title="Penjualan produk sumber yang dipindahkan, dan ulasan produk sumber yang ikut tampil di halaman produk target">Penjualan / ulasan sumber</th>
                    <th className="px-3 py-2.5 text-right font-medium" title="Penjualan produk sumber yang sudah dicapai dibanding target notifikasi yang Anda tetapkan. Notifikasi terkirim saat target tercapai">Ambang</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {boosts.map((boost) => (
                    <tr key={boost.id} className="border-b border-border align-top last:border-0">
                      <td className="max-w-md px-5 py-3">
                        <p className="truncate font-medium text-foreground" title={`${boost.source?.label ?? "Produk sumber dihapus"} ke ${boost.target?.label ?? "Produk target dihapus"}`}>
                          {boost.source?.label ?? "Produk sumber dihapus"}
                        </p>
                        <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                          <Icon name="arrow-down" className="size-3 shrink-0" aria-hidden="true" />
                          {boost.target?.label ?? "Produk target dihapus"}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums" title="Penjualan dan ulasan produk sumber yang dipindahkan ke produk target">
                        {formatNumber(boost.source_sold_count)} unit
                        {" / "}
                        {boost.source_review_count > 0
                          ? `${formatNumber(boost.source_review_count)} ulasan`
                          : "belum ada ulasan"}
                        {boost.source_review_count > 0 && boost.source_avg_rating
                          ? <span className="block text-[11px] text-muted-foreground">bintang {formatNumber(boost.source_avg_rating)} dari 5</span>
                          : null}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums" title={`Penjualan sumber ${formatNumber(boost.source_sold_count)} dari target notifikasi ${formatNumber(boost.notification_threshold ?? 0)}. Notifikasi terkirim saat target tercapai.`}>
                        {boost.notification_threshold
                          ? `${formatNumber(boost.source_sold_count)}/${formatNumber(boost.notification_threshold)}`
                          : <span className="text-muted-foreground">Tidak diatur</span>}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={boost.enabled ? "active" : "inactive"} />
                        {!boost.enabled && boost.disabled_reason ? (
                          <p className="mt-1 max-w-48 text-[11px] text-muted-foreground" title={boost.disabled_reason}>
                            {boost.disabled_reason}
                          </p>
                        ) : null}
                        {boost.source?.status === "archived" || boost.target?.status === "archived" ? (
                          <p className="mt-1 max-w-48 text-[11px] text-warning-foreground" title="Produk sumber atau target sudah diarsipkan; boost tidak dapat diaktifkan ulang sampai produknya aktif kembali.">
                            Produk diarsipkan
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <RowActions className="flex-nowrap">
                          <Button type="button" variant="secondary" size="xs" onClick={() => openEdit(boost)}>
                            Edit
                          </Button>
                          <RowActionsMenu>
                            {boost.enabled ? (
                              <ConfirmAction
                                trigger={
                                  <button
                                    type="button"
                                    className="w-full px-2 py-1.5 text-left text-xs hover:bg-muted"
                                  >
                                    Nonaktifkan
                                  </button>
                                }
                                title="Nonaktifkan Teruskan Popularitas?"
                                description="Seed target akan dikosongkan. Penjualan target yang asli tetap aman dan tidak dihapus."
                                confirmLabel="Nonaktifkan"
                                reasonLabel="Alasan"
                                reasonPlaceholder="Contoh: model sumber sudah tidak relevan"
                                reasonRequired
                                onConfirm={(reason) => {
                                  if (!reason) return
                                  router.post(boost.disable_url, { reason }, { preserveScroll: true })
                                }}
                              />
                            ) : (
                              <DropdownMenuItem asChild>
                                <button
                                  type="button"
                                  className="w-full text-left"
                                  onClick={() => router.post(boost.enable_url, {}, { preserveScroll: true })}
                                >
                                  Aktifkan kembali
                                </button>
                              </DropdownMenuItem>
                            )}
                            <ConfirmAction
                              trigger={
                                <button
                                  type="button"
                                  className="w-full px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                                >
                                  Hapus
                                </button>
                              }
                              title="Hapus Teruskan Popularitas?"
                              description={boost.enabled
                                ? "Konfigurasi dihapus permanen dan seed popularitas produk target dikosongkan. Penjualan dan ulasan asli tetap aman."
                                : "Riwayat konfigurasi ini dihapus permanen."}
                              confirmLabel="Hapus"
                              onConfirm={() => router.delete(boost.delete_url, { preserveScroll: true })}
                            />
                          </RowActionsMenu>
                        </RowActions>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pagination && pagination.last_page > 1 ? (
            <div className="border-t border-border px-5 py-3">
              <Pagination pagination={pagination} />
            </div>
          ) : null}
        </SectionCard>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>Tambah Teruskan Popularitas</DialogTitle>
          <DialogDescription>
            Dasar Teruskan Popularitas hanya dua: penjualan valid (menjadi seed ranking target)
            dan ulasan website terpublikasi (tampil di PDP target dengan ratingnya).
            View, klik, dan riwayat order tidak ikut dipindahkan.
          </DialogDescription>
          <form id="boost-create-form" onSubmit={submitCreate} className="grid gap-4">
            <Field id="source_product_id" label="Produk sumber (A)" hint="Penjualan produk sumber saat ini dipindahkan sebagai popularitas awal produk target." error={form.errors.source_product_id} required>
              <SearchSelect
                id="source_product_id"
                options={products.map((product) => ({ value: String(product.id), label: product.label }))}
                value={form.data.source_product_id}
                onValueChange={(value) => form.setData("source_product_id", value)}
                placeholder="Pilih produk sumber"
                searchPlaceholder="Cari SKU atau nama produk"
                emptyMessage="Produk tidak ditemukan."
                error={form.errors.source_product_id}
              />
            </Field>
            <Field id="target_product_id" label="Produk target (B)" hint="Popularitas target = pindahan penjualan sumber + penjualan target sendiri." error={form.errors.target_product_id} required>
              <SearchSelect
                id="target_product_id"
                options={products.map((product) => ({ value: String(product.id), label: product.label }))}
                value={form.data.target_product_id}
                onValueChange={(value) => form.setData("target_product_id", value)}
                placeholder="Pilih produk target"
                searchPlaceholder="Cari SKU atau nama produk"
                emptyMessage="Produk tidak ditemukan."
                error={form.errors.target_product_id}
              />
            </Field>
            <Field id="notification_threshold" label="Ambang notifikasi" hint="Opsional, unit penjualan sumber." error={form.errors.notification_threshold}>
              <Input type="number" min="1" value={form.data.notification_threshold} onChange={(event) => form.setData("notification_threshold", event.target.value)} placeholder="Contoh: 100" />
            </Field>
            <FormErrorSummary errors={form.errors} />
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button type="submit" disabled={form.processing}>
                {form.processing ? "Menyimpan..." : "Aktifkan Teruskan Popularitas"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editBoost)} onOpenChange={(open) => { if (!open) setEditBoost(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>Edit Teruskan Popularitas</DialogTitle>
          <DialogDescription>
            Mengubah sumber atau target menghitung ulang pindahan popularitas dari penjualan sumber
            terbaru; target lama dibersihkan bila pasangan berpindah. Ambang yang diubah memulai
            siklus notifikasi baru.
          </DialogDescription>
          <form id="boost-edit-form" onSubmit={submitEdit} className="grid gap-4">
            <Field id="edit_source_product_id" label="Produk sumber (A)" hint="Penjualan produk sumber saat ini dipindahkan sebagai popularitas awal produk target." error={editForm.errors.source_product_id} required>
              <SearchSelect
                id="edit_source_product_id"
                options={products.map((product) => ({ value: String(product.id), label: product.label }))}
                value={editForm.data.source_product_id}
                onValueChange={(value) => editForm.setData("source_product_id", value)}
                placeholder="Pilih produk sumber"
                searchPlaceholder="Cari SKU atau nama produk"
                emptyMessage="Produk tidak ditemukan."
                error={editForm.errors.source_product_id}
              />
            </Field>
            <Field id="edit_target_product_id" label="Produk target (B)" hint="Popularitas target = pindahan penjualan sumber + penjualan target sendiri." error={editForm.errors.target_product_id} required>
              <SearchSelect
                id="edit_target_product_id"
                options={products.map((product) => ({ value: String(product.id), label: product.label }))}
                value={editForm.data.target_product_id}
                onValueChange={(value) => editForm.setData("target_product_id", value)}
                placeholder="Pilih produk target"
                searchPlaceholder="Cari SKU atau nama produk"
                emptyMessage="Produk tidak ditemukan."
                error={editForm.errors.target_product_id}
              />
            </Field>
            <Field id="edit_notification_threshold" label="Ambang notifikasi" hint="Opsional, unit penjualan sumber. Notifikasi terkirim saat target tercapai." error={editForm.errors.notification_threshold}>
              <Input type="number" min="1" value={editForm.data.notification_threshold} onChange={(event) => editForm.setData("notification_threshold", event.target.value)} placeholder="Contoh: 100" />
            </Field>
            <FormErrorSummary errors={editForm.errors} />
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="secondary" onClick={() => setEditBoost(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={editForm.processing}>
                {editForm.processing ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
