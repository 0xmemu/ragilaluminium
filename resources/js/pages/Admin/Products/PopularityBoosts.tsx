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
    <AdminLayout title={title} description={description}>
      <Head title={title + " | Admin"} />

      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon name="trending-up" className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Buat alur sumber → target</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                Snapshot penjualan valid produk sumber disimpan sebagai seed popularitas target.
                Produk tetap aktif dengan model berbeda, dan tidak ada riwayat order yang dipindahkan.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_auto] lg:items-end">
            <Field id="source_product_id" label="Produk sumber (A)" hint="Penjualan valid saat aksi dijalankan menjadi seed." error={form.errors.source_product_id} required>
              <Select value={form.data.source_product_id} onChange={(event) => form.setData("source_product_id", event.target.value)} required>
                <option value="">Pilih produk sumber</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}
              </Select>
            </Field>
            <Field id="target_product_id" label="Produk target (B)" hint="Popularitas target = seed sumber + penjualan target sendiri." error={form.errors.target_product_id} required>
              <Select value={form.data.target_product_id} onChange={(event) => form.setData("target_product_id", event.target.value)} required>
                <option value="">Pilih produk target</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}
              </Select>
            </Field>
            <Field id="notification_threshold" label="Ambang notifikasi" hint="Opsional, unit penjualan sumber." error={form.errors.notification_threshold}>
              <Input type="number" min="1" value={form.data.notification_threshold} onChange={(event) => form.setData("notification_threshold", event.target.value)} placeholder="Contoh: 100" />
            </Field>
            <Button type="submit" disabled={form.processing}>{form.processing ? "Menyimpan..." : "Aktifkan"}</Button>
          </form>
          <FormErrorSummary errors={form.errors} className="mt-4" />
        </Card>

        {boosts.length ? (
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Riwayat konfigurasi</h2>
              <p className="mt-1 text-xs text-muted-foreground">Setiap tindakan aktif/nonaktif tercatat di Log Aktivitas.</p>
            </div>
            <div className="divide-y divide-border">
              {boosts.map((boost) => (
                <article key={boost.id} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {(boost.source?.label ?? "Produk sumber dihapus") + " → " + (boost.target?.label ?? "Produk target dihapus")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Diperbarui {dateLabel(boost.updated_at)}</p>
                    </div>
                    <StatusBadge status={boost.enabled ? "active" : "archived"} />
                  </div>
                  <div className="grid gap-2 text-xs sm:grid-cols-4">
                    <Metric label="Seed sumber" value={formatNumber(boost.seed_sold_count)} />
                    <Metric label="Penjualan target" value={formatNumber(boost.target_sold_count)} />
                    <Metric label="Skor efektif" value={formatNumber(boost.effective_score)} />
                    <Metric label="Ambang" value={boost.notification_threshold ? formatNumber(boost.notification_threshold) : "Tidak diatur"} />
                  </div>
                  {boost.threshold_notified_at ? <p className="text-xs text-warning-foreground">Notifikasi ambang dikirim {dateLabel(boost.threshold_notified_at)}.</p> : null}
                  {!boost.enabled && boost.disabled_reason ? <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">Alasan nonaktif: {boost.disabled_reason}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    {boost.enabled ? (
                      <ConfirmAction
                        trigger={<Button variant="destructive" size="sm">Nonaktifkan</Button>}
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
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => router.post(boost.enable_url, {}, { preserveScroll: true })}
                      >
                        Aktifkan kembali
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </Card>
        ) : (
          <EmptyState icon="trending-up" title="Belum ada konfigurasi popularitas" description="Pilih produk sumber dan target untuk membuat seed popularitas yang terdokumentasi." />
        )}
      </div>
    </AdminLayout>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <p className="font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-muted-foreground">{label}</p>
    </div>
  )
}
