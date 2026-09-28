import { useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Checkbox } from "@/components/admin/ui/checkbox"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import { formatCurrency } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { can, useAdminCapabilities } from "@/lib/capabilities"
import { cn } from "@/lib/utils"

/** Pilihan alasan retur; dipakai juga form koreksi kasus di halaman detail. */
export const RETURN_REASONS = [
  { value: "rusak", label: "Rusak" },
  { value: "pecah", label: "Pecah" },
  { value: "salah_ukuran", label: "Salah ukuran" },
  { value: "salah_produk", label: "Salah produk" },
  { value: "kurang", label: "Barang kurang" },
  { value: "lainnya", label: "Lainnya" },
]

/** Field item pesanan yang dibutuhkan form retur; cocok untuk payload daftar maupun detail. */
export interface ReturnCreateFormItem {
  id: number
  name: string
  unit_price: number
  quantity: number
}

/**
 * Form pencatatan kasus retur admin (skema full manual: tidak ada form retur
 * publik, admin yang mencatat).
 *
 * Satu form dipakai bersama oleh halaman detail pesanan dan dialog retur di
 * daftar pesanan (owner 2026-09-28: klik Retur di daftar harus membuka popup
 * pengisian, bukan pindah halaman), sehingga markup dan kontrak kiriman tidak
 * bisa saling beda.
 *
 * Kiriman selalu ke route yang sama (admin.orders.returns.store). Jalur retur
 * manual pesanan Selesai hanya aktif bila `returManual`: wajib alasan
 * pengecualian dan kiriman membawa penanda late_return.
 */
export function ReturnCreateForm({
  orderId,
  items,
  returManual = false,
  onSubmitted,
}: {
  orderId: number
  items: ReturnCreateFormItem[]
  /** Retur manual pesanan Selesai: tampilkan alasan pengecualian + kirim late_return. */
  returManual?: boolean
  /** Dipanggil setelah kasus retur berhasil dicatat (mis. penutup dialog). */
  onSubmitted?: () => void
}) {
  const form = useForm({
    reason: "rusak",
    reason_detail: "",
    customer_notes: "",
    admin_notes: "",
    fault_party: "store",
    shipping_cost_borne_by_store: true,
    override_reason: "",
    items: items.map((item) => ({ order_item_id: item.id, requested_quantity: item.quantity, included: true })),
  })
  const capabilities = useAdminCapabilities()

  const totalUnitRetur = form.data.items.filter((row) => row.included).reduce((n, row) => n + row.requested_quantity, 0)
  const totalUnitDipesan = items.reduce((n, item) => n + item.quantity, 0)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    // Item yang tidak dicentang tidak dikirim; validasi server memang
    // menerima sebagian item (larik items min:1). Jalur retur manual
    // pesanan Selesai wajib membawa penanda late_return + alasannya.
    form.transform((data) => ({
      ...data,
      ...(returManual ? { late_return: true, override_reason: data.override_reason } : {}),
      items: data.items
        .filter((row) => row.included)
        .map(({ order_item_id, requested_quantity }) => ({ order_item_id, requested_quantity })),
    }))
    form.post(routeUrl("admin.orders.returns.store", { order: orderId }), {
      preserveScroll: true,
      onSuccess: () => onSubmitted?.(),
    })
  }

  return (
    <form className="space-y-3 border-t border-border pt-4" onSubmit={submit}>
      <p className="text-xs text-muted-foreground">Isi admin. Customer mengirim kronologi/foto melalui WhatsApp; tidak ada form retur publik.</p>
      <FormErrorSummary errors={form.errors} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="return-reason" label="Alasan retur" required error={form.errors.reason}>
          <Select value={form.data.reason} onChange={(event) => {
            form.setData("reason", event.target.value)
            const storeParty = ["rusak", "pecah", "salah_ukuran", "salah_produk", "kurang"].includes(event.target.value)
            form.setData("fault_party", storeParty ? "store" : "other")
          }}>
            {RETURN_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
        </Field>
        <Field id="return-fault-party" label="Pihak penyebab">
          <Select value={form.data.fault_party} onChange={(event) => {
            form.setData("fault_party", event.target.value)
            form.setData("shipping_cost_borne_by_store", event.target.value === "store")
          }}>
            <option value="store">Toko</option>
            <option value="customer">Pelanggan</option>
            <option value="other">Lainnya</option>
          </Select>
        </Field>
        <Field id="return-shipping" label="Ongkir retur ditanggung toko">
          <Select
            value={form.data.shipping_cost_borne_by_store ? "true" : "false"}
            onChange={(event) => form.setData("shipping_cost_borne_by_store", event.target.value === "true")}
          >
            <option value="true">Ya</option>
            <option value="false">Tidak</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {returManual ? (
          <Field id="return-override-reason" label="Alasan pengecualian retur manual" required error={form.errors.override_reason}>
            <Textarea
              rows={2}
              value={form.data.override_reason}
              onChange={(event) => form.setData("override_reason", event.target.value)}
              placeholder="Contoh: pelanggan baru melaporkan kerusakan setelah masa retur habis"
            />
          </Field>
        ) : null}
        {form.data.reason === "lainnya" ? (
          <Field id="return-reason-detail" label="Keterangan lainnya" required error={form.errors.reason_detail}>
            <Textarea rows={2} value={form.data.reason_detail} onChange={(event) => form.setData("reason_detail", event.target.value)} />
          </Field>
        ) : null}
        <Field id="return-customer-notes" label="Kronologi pelanggan" required error={form.errors.customer_notes}>
          <Textarea rows={2} value={form.data.customer_notes} onChange={(event) => form.setData("customer_notes", event.target.value)} />
        </Field>
        <Field id="return-admin-notes" label="Catatan admin (opsional)" error={form.errors.admin_notes}>
          <Textarea rows={2} value={form.data.admin_notes} onChange={(event) => form.setData("admin_notes", event.target.value)} placeholder="Bukti unboxing/foto dikirim via WhatsApp, hasil inspeksi, dll." />
        </Field>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold">Item yang diretur</p>
          <p className="text-xs text-muted-foreground">
            {totalUnitRetur} dari {totalUnitDipesan} unit dipilih retur
          </p>
        </div>
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {form.data.items.map((row, index) => {
            const item = items.find((i) => i.id === row.order_item_id) ?? items[index]
            const maksUnit = item?.quantity ?? 1
            const ikut = row.included
            const ubahJumlah = (nilai: number) =>
              form.setData(
                "items",
                form.data.items.map((line, i) =>
                  i === index ? { ...line, requested_quantity: Math.min(maksUnit, Math.max(1, nilai)) } : line,
                ),
              )
            return (
              <div key={row.order_item_id} className={cn("flex items-center gap-3 px-3 py-2.5", !ikut && "bg-muted/30 opacity-60")}>
                <Checkbox
                  checked={ikut}
                  onChange={(event) =>
                    form.setData(
                      "items",
                      form.data.items.map((line, i) => (i === index ? { ...line, included: event.target.checked } : line)),
                    )
                  }
                  aria-label={ikut ? "Keluarkan item ini dari retur" : "Ikutkan item ini ke retur"}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-[13px] font-medium", !ikut && "line-through decoration-muted-foreground/50")}>
                    {item?.name ?? `Item #${row.order_item_id}`}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatCurrency(item?.unit_price ?? 0)} · {maksUnit} unit dipesan
                  </p>
                </div>
                {maksUnit > 1 ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={!ikut || row.requested_quantity <= 1}
                      onClick={() => ubahJumlah(row.requested_quantity - 1)}
                      aria-label="Kurangi jumlah unit retur"
                    >
                      <Icon name="minus" className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Input
                      className="w-14 text-center"
                      type="number"
                      min={1}
                      max={maksUnit}
                      value={String(row.requested_quantity)}
                      disabled={!ikut}
                      aria-label={`Jumlah unit retur untuk ${item?.name ?? "item"}`}
                      onChange={(event) => ubahJumlah(Number(event.target.value) || 1)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={!ikut || row.requested_quantity >= maksUnit}
                      onClick={() => ubahJumlah(row.requested_quantity + 1)}
                      aria-label="Tambah jumlah unit retur"
                    >
                      <Icon name="plus" className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
        {form.errors.items ? <p className="text-xs font-medium text-destructive">{form.errors.items}</p> : null}
      </div>
      <Button
        type="submit"
        disabled={form.processing || totalUnitRetur === 0 || !can("returns.create", capabilities)}
        title={can("returns.create", capabilities) ? undefined : "Kamu tidak punya akses mencatat retur"}
      >
        {form.processing ? "Menyimpan..." : "Catat retur"}
      </Button>
    </form>
  )
}
