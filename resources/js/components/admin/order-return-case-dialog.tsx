import * as React from "react"
import { router } from "@inertiajs/react"

import { RETURN_REASONS } from "@/components/admin/order-return-create-form"
import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/admin/ui/dialog"
import { Field } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { QuantityInput } from "@/components/admin/ui/quantity-input"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Textarea } from "@/components/admin/ui/textarea"
import { can, useAdminCapabilities } from "@/lib/capabilities"
import { formatCurrency, formatDateTime, humanize } from "@/lib/format"
import { routeUrl } from "@/lib/routes"

/** Satu item kasus retur sebagaimana dikirim OrderController. */
export interface ReturnCaseItemRow {
  id: number
  order_item_id: number
  name?: string | null
  unit_price: number
  requested_quantity: number
  returned_quantity: number
  replacement_quantity?: number
}

/** Satu kasus retur pada satu pesanan. */
export interface ReturnCaseRow {
  id: number
  status: string
  reason: string
  reason_detail?: string | null
  fault_party?: string | null
  shipping_cost_borne_by_store: boolean
  resolution_type?: string | null
  customer_notes?: string | null
  admin_notes?: string | null
  refund_amount: number
  replacement_amount: number
  return_shipping_cost: number
  completed_at?: string | null
  late_return?: boolean
  voided_at?: string | null
  void_reason?: string | null
  items: ReturnCaseItemRow[]
}

/** Satu baris jejak audit koreksi/void kasus retur (tabel return_case_adjustments). */
export interface ReturnAdjustment {
  id: number
  return_case_id: number
  field: string
  old_value?: string | null
  new_value?: string | null
  reason: string
  actor?: string | null
  created_at?: string | null
}

/** Baris item pesanan yang dibutuhkan form penyelesaian (barang pengganti). */
export interface ReturnCaseDialogItem {
  id: number
  name: string
  product_id?: number
  variant_id?: number | null
  unit_price: number
  quantity: number
}

/** Pesanan yang kasus returnya sedang ditangani di popup ini. */
export interface ReturnCaseDialogOrder {
  id: number
  order_number: string
  total_amount: number
  payment_status: string
  /** Jumlah pembayaran yang sudah tercatat lunas, untuk batas refund. */
  paid_amount?: number
  items: ReturnCaseDialogItem[]
  return_cases?: ReturnCaseRow[]
  return_adjustments?: ReturnAdjustment[]
}

const RESOLUTION_LABELS: Record<string, string> = {
  refund: "Refund",
  replacement: "Ganti barang",
  reship: "Kirim ulang",
  compensation: "Kompensasi",
  no_compensation: "Tanpa kompensasi",
}

/** Label manusiawi field kasus retur untuk jejak audit koreksi. */
const AUDIT_FIELD_LABELS: Record<string, string> = {
  reason: "Alasan",
  reason_detail: "Keterangan alasan",
  customer_notes: "Kronologi pelanggan",
  fault_party: "Pihak penyebab",
  resolution_type: "Resolusi",
  refund_amount: "Refund",
  return_shipping_cost: "Ongkir retur toko",
  replacement_amount: "Nilai penggantian",
  void: "Penutupan kasus",
}

/** Isian awal form koreksi dari nilai kasus saat ini. */
function editFormDari(caseItem: ReturnCaseRow) {
  return {
    reason: caseItem.reason,
    customer_notes: caseItem.customer_notes ?? "",
    fault_party: caseItem.fault_party ?? "other",
    resolution_type: caseItem.resolution_type ?? "refund",
    refund_amount: String(caseItem.refund_amount ?? 0),
    return_shipping_cost: String(caseItem.return_shipping_cost ?? 0),
    replacement_amount: String(caseItem.replacement_amount ?? 0),
  }
}

function labelPihak(fault: string | null | undefined): string {
  return fault === "store" ? "Toko" : fault === "customer" ? "Pelanggan" : "Lainnya"
}

/**
 * Popup penanganan kasus retur, dipakai dari daftar pesanan (permintaan owner
 * 2026-09-29: tombol "Selesaikan Retur" langsung membuka popup, tanpa pindah ke
 * halaman detail). Panel "Retur & penyelesaian" di halaman detail sudah dihapus,
 * jadi SEMUA aksi retur pindah ke sini: menyelesaikan kasus, menutup kasus
 * (void), dan mengoreksi kasus yang sudah selesai.
 *
 * Form penyelesaian sengaja tampil LANGSUNG untuk kasus terbuka, bukan di balik
 * satu klik lagi, supaya admin yang menekan tombol dari daftar langsung bisa
 * mengisi. Sebelumnya form itu bersembunyi di balik state, sehingga begitu
 * popupnya ditutup tombolnya tidak pernah kembali dan panelnya jadi kotak kosong.
 */
export function OrderReturnCaseDialog({
  order,
  onClose,
}: {
  order: ReturnCaseDialogOrder | null
  onClose: () => void
}) {
  return (
    <Dialog open={Boolean(order)} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="w-[min(calc(100vw-2rem),56rem)] bg-card text-card-foreground">
        <DialogTitle>Retur &amp; penyelesaian {order?.order_number ?? ""}</DialogTitle>
        <DialogDescription>
          Penyelesaian kasus dikunci setelah disimpan. Gunakan void bila kasusnya salah catat.
        </DialogDescription>
        {order ? (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <IsiKasusRetur key={order.id} order={order} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function IsiKasusRetur({ order }: { order: ReturnCaseDialogOrder }) {
  const capabilities = useAdminCapabilities()
  const cases = order.return_cases ?? []
  const adjustments = order.return_adjustments ?? []

  const [editReplacement, setEditReplacement] = React.useState<Record<number, boolean>>({})
  const [completionError, setCompletionError] = React.useState<string | null>(null)
  const [editError, setEditError] = React.useState<string | null>(null)
  const [editData, setEditData] = React.useState<
    Record<
      number,
      {
        reason: string
        customer_notes: string
        fault_party: string
        resolution_type: string
        refund_amount: string
        return_shipping_cost: string
        replacement_amount: string
      }
    >
  >({})

  // Form penyelesaian tiap kasus terbuka, diisi sejak awal (bukan lewat klik)
  // supaya popup dari daftar langsung siap dipakai.
  const [completion, setCompletion] = React.useState<
    Record<
      number,
      {
        resolution_type: string
        admin_notes: string
        refund_amount: string
        return_shipping_cost: string
        additional_shipping_amount: string
        replacement_items: Array<{
          order_item_id: number
          product_id: number
          variant_id: string
          quantity: string
          name: string
        }>
      }
    >
  >(() => {
    const awal: Record<number, never> = {}
    for (const kasus of cases) {
      if (kasus.status !== "open" || kasus.voided_at) continue
      ;(awal as Record<number, unknown>)[kasus.id] = {
        resolution_type: "refund",
        admin_notes: "",
        refund_amount: "0",
        return_shipping_cost: "",
        additional_shipping_amount: "",
        replacement_items: kasus.items.map((ci) => {
          const orderItem = order.items.find((oi) => oi.id === ci.order_item_id)
          return {
            order_item_id: ci.order_item_id,
            product_id: orderItem?.product_id ?? 0,
            variant_id: orderItem?.variant_id != null ? String(orderItem.variant_id) : "",
            quantity: String(ci.requested_quantity),
            name: orderItem?.name ?? ci.name ?? `Item #${ci.order_item_id}`,
          }
        }),
      }
    }
    return awal as never
  })

  const formSelesaiRef = React.useRef<Record<number, HTMLFormElement | null>>({})

  // Batas refund yang sah menurut backend: nilai terkecil antara total pesanan
  // dan jumlah pembayaran yang benar-benar sudah dicatat lunas.
  const totalDibayar = order.paid_amount ?? 0
  const maksRefund =
    totalDibayar > 0 ? Math.min(order.total_amount, totalDibayar) : order.total_amount
  const bolehRefund = order.payment_status === "paid"

  function submitComplete(caseItem: ReturnCaseRow) {
    const data = completion[caseItem.id]
    if (!data) return
    const payload: {
      resolution_type: string
      admin_notes: string
      refund_amount: number
      return_shipping_cost: number
      additional_shipping_amount: number
      returned_items: Array<{ id: number; returned_quantity: number }>
      replacement_items?: Array<{
        order_item_id: number
        product_id: number
        variant_id: number | null
        quantity: number
      }>
    } = {
      resolution_type: data.resolution_type,
      admin_notes: data.admin_notes,
      refund_amount: ["refund", "compensation"].includes(data.resolution_type)
        ? Number(data.refund_amount) || 0
        : 0,
      return_shipping_cost: Number(data.return_shipping_cost) || 0,
      additional_shipping_amount: Number(data.additional_shipping_amount) || 0,
      returned_items: caseItem.items.map((ci) => ({
        id: ci.id,
        returned_quantity: ci.requested_quantity,
      })),
    }
    if (data.resolution_type === "replacement" || data.resolution_type === "reship") {
      payload.replacement_items = data.replacement_items.map((r) => ({
        order_item_id: r.order_item_id,
        product_id: Number(r.product_id) || 0,
        variant_id: r.variant_id ? Number(r.variant_id) : null,
        quantity: Number(r.quantity) || 1,
      }))
    }
    setCompletionError(null)
    router.post(
      routeUrl("admin.orders.returns.complete", { order: order.id, returnCase: caseItem.id }),
      payload,
      {
        preserveScroll: true,
        onError: (errors) => {
          const pesan = Object.values(errors).filter(Boolean)
          setCompletionError(
            pesan.length > 0
              ? pesan.join(" ")
              : "Penyelesaian retur belum berhasil disimpan. Periksa kembali isian form.",
          )
        },
      },
    )
  }

  /** Simpan koreksi lewat PATCH; alasan koreksi datang dari dialog konfirmasi. */
  function submitEdit(caseItem: ReturnCaseRow, adjustmentReason: string) {
    const data = editData[caseItem.id]
    if (!data) return
    setEditError(null)
    router.patch(
      routeUrl("admin.orders.returns.update", { order: order.id, returnCase: caseItem.id }),
      {
        reason: data.reason,
        customer_notes: data.customer_notes,
        fault_party: data.fault_party,
        resolution_type: data.resolution_type,
        refund_amount: Number(data.refund_amount) || 0,
        return_shipping_cost: Number(data.return_shipping_cost) || 0,
        replacement_amount: Number(data.replacement_amount) || 0,
        adjustment_reason: adjustmentReason,
      },
      {
        preserveScroll: true,
        onSuccess: () =>
          setEditData((current) => {
            const next = { ...current }
            delete next[caseItem.id]
            return next
          }),
        onError: (errors) => {
          const pesan = Object.values(errors).filter(Boolean)
          setEditError(pesan.length > 0 ? pesan.join(" ") : "Koreksi retur belum berhasil disimpan.")
        },
      },
    )
  }

  /** Tutup kasus secara administratif (void); alasan wajib dari dialog. */
  function submitVoid(caseItem: ReturnCaseRow, alasan: string) {
    router.post(
      routeUrl("admin.orders.returns.void", { order: order.id, returnCase: caseItem.id }),
      { void_reason: alasan },
      { preserveScroll: true },
    )
  }

  if (cases.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Tidak ada kasus retur yang perlu diselesaikan pada pesanan ini.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {cases.map((item) => (
        <div key={item.id} className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">
              Kasus #{item.id} · {item.reason}
              {item.reason === "lainnya" && item.reason_detail ? ` - ${item.reason_detail}` : ""}
              {item.late_return ? (
                <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Retur manual
                </span>
              ) : null}
            </span>
            <span className="flex items-center gap-2">
              {item.voided_at ? (
                <span className="rounded-full border border-destructive/30 px-2 py-0.5 text-[11px] font-medium text-destructive">
                  Di-void
                </span>
              ) : null}
              <StatusBadge status={item.status} />
            </span>
          </div>
          {item.customer_notes ? (
            <p className="mt-2 text-xs text-muted-foreground">{item.customer_notes}</p>
          ) : null}
          {item.admin_notes ? (
            <p className="mt-1 text-xs text-muted-foreground">Catatan admin: {item.admin_notes}</p>
          ) : null}
          {item.fault_party ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Pihak penyebab: {labelPihak(item.fault_party)} · Ongkir ditanggung toko:{" "}
              {item.shipping_cost_borne_by_store ? "Ya" : "Tidak"}
            </p>
          ) : null}

          {item.status === "open" ? (
            <div className="mt-3 border-t border-border pt-3">
              <form
                ref={(node) => {
                  formSelesaiRef.current[item.id] = node
                }}
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  submitComplete(item)
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id={`return-resolution-${item.id}`} label="Resolusi" required>
                    <Select
                      value={completion[item.id]?.resolution_type ?? "refund"}
                      onChange={(event) =>
                        setCompletion((current) => ({
                          ...current,
                          [item.id]: { ...current[item.id], resolution_type: event.target.value },
                        }))
                      }
                    >
                      {/* Refund hanya sah untuk pesanan lunas (kontrak retur):
                          uang yang tidak pernah diterima tidak boleh
                          dikembalikan. Aturannya ditegakkan backend; di sini
                          ditampilkan supaya admin tidak memilih resolusi yang
                          pasti ditolak. */}
                      <option value="refund" disabled={!bolehRefund}>
                        Refund{bolehRefund ? "" : " (pesanan belum lunas)"}
                      </option>
                      <option value="replacement">Ganti barang</option>
                      <option value="reship">Kirim ulang</option>
                      <option value="compensation">Kompensasi</option>
                      <option value="no_compensation">Tanpa kompensasi</option>
                    </Select>
                  </Field>
                  <Field
                    id={`return-completion-note-${item.id}`}
                    label="Catatan penyelesaian"
                    required
                  >
                    <Textarea
                      rows={2}
                      value={completion[item.id]?.admin_notes ?? ""}
                      onChange={(event) =>
                        setCompletion((current) => ({
                          ...current,
                          [item.id]: { ...current[item.id], admin_notes: event.target.value },
                        }))
                      }
                    />
                  </Field>
                </div>

                {["refund", "compensation"].includes(completion[item.id]?.resolution_type ?? "") ? (
                  <Field
                    id={`return-refund-${item.id}`}
                    label={
                      completion[item.id]?.resolution_type === "refund"
                        ? "Refund Retur"
                        : "Nominal Kompensasi"
                    }
                    required
                  >
                    <Input
                      type="number"
                      min="0"
                      max={maksRefund}
                      value={completion[item.id]?.refund_amount ?? "0"}
                      onChange={(event) =>
                        setCompletion((current) => ({
                          ...current,
                          [item.id]: { ...current[item.id], refund_amount: event.target.value },
                        }))
                      }
                    />
                    <p
                      className="text-[11px] text-muted-foreground"
                      title="Pengembalian dana kepada pelanggan. Mengurangi Penjualan Bersih saat retur selesai."
                    >
                      {bolehRefund
                        ? `Maksimum ${formatCurrency(maksRefund)} · refund mengurangi Penjualan Bersih`
                        : "Pesanan ini belum tercatat lunas, jadi refund belum bisa diproses. Pilih resolusi lain atau catat pelunasan lebih dulu."}
                    </p>
                  </Field>
                ) : null}

                {["replacement", "reship"].includes(completion[item.id]?.resolution_type ?? "") ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">Barang pengganti (terkunci default)</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEditReplacement((current) => ({
                            ...current,
                            [item.id]: !current[item.id],
                          }))
                        }
                      >
                        {editReplacement[item.id] ? "Kunci item" : "Ubah item pengganti"}
                      </Button>
                    </div>
                    {completion[item.id]?.replacement_items.map((r, idx) => (
                      <div key={r.order_item_id} className="flex items-center gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate">{r.name}</span>
                        {editReplacement[item.id] ? (
                          <QuantityInput
                            value={Number(r.quantity) || 1}
                            ariaLabel={`Jumlah barang pengganti ${r.name}`}
                            onChange={(qty) =>
                              setCompletion((current) => ({
                                ...current,
                                [item.id]: {
                                  ...current[item.id],
                                  replacement_items: current[item.id].replacement_items.map(
                                    (rr, i) => (i === idx ? { ...rr, quantity: String(qty) } : rr),
                                  ),
                                },
                              }))
                            }
                          />
                        ) : (
                          <span className="tabular-nums">{r.quantity} pcs</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}

                <Field
                  id={`return-shipping-cost-${item.id}`}
                  label="Ongkir Retur Ditanggung Toko"
                  required={item.fault_party === "store"}
                >
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={completion[item.id]?.return_shipping_cost ?? ""}
                    onChange={(event) =>
                      setCompletion((current) => ({
                        ...current,
                        [item.id]: { ...current[item.id], return_shipping_cost: event.target.value },
                      }))
                    }
                  />
                  <p
                    className="text-[11px] text-muted-foreground"
                    title="Biaya operasional ongkir pengembalian yang ditanggung toko. Mengurangi Penjualan Bersih."
                  >
                    {item.fault_party === "store"
                      ? "Biaya ongkir pengembalian yang ditanggung toko karena kesalahan toko. Wajib diisi. Mengurangi Penjualan Bersih."
                      : "Biaya ongkir pengembalian yang ditanggung toko (opsional, goodwill). Mengurangi Penjualan Bersih."}
                  </p>
                </Field>

                <Field
                  id={`return-trip-cost-${item.id}`}
                  label="Ongkir Perjalanan Balik (opsional)"
                  hint="Tagihan pengembalian barang dari J&T yang ditanggung kas toko. Mengurangi Penjualan Bersih. Kosongkan bila tidak ada."
                >
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={completion[item.id]?.additional_shipping_amount ?? ""}
                    onChange={(event) =>
                      setCompletion((current) => ({
                        ...current,
                        [item.id]: {
                          ...current[item.id],
                          additional_shipping_amount: event.target.value,
                        },
                      }))
                    }
                  />
                </Field>

                {completionError ? (
                  <p
                    role="alert"
                    className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                  >
                    {completionError}
                  </p>
                ) : null}

                {/* Penyelesaian retur bersifat terminal: kasus dikunci, pesanan
                    masuk Retur Selesai, stok pengganti dipotong, dan pembayaran
                    menggantung dibatalkan. Pola repo memakai ConfirmAction untuk
                    aksi ireversibel, jadi tombol simpan pun dikonfirmasi dulu. */}
                <div className="flex flex-wrap items-center gap-2">
                  <ConfirmAction
                    trigger={
                      <Button
                        type="button"
                        size="sm"
                        disabled={!can("returns.complete", capabilities)}
                        title={
                          can("returns.complete", capabilities)
                            ? undefined
                            : "Kamu tidak punya akses menyelesaikan retur"
                        }
                      >
                        Tandai retur selesai
                      </Button>
                    }
                    title="Selesaikan kasus retur ini?"
                    description="Kasus retur dikunci dan pesanan berpindah ke Retur Selesai. Tindakan ini tidak bisa dibatalkan atau diulang."
                    confirmLabel="Tandai retur selesai"
                    onConfirm={() => formSelesaiRef.current[item.id]?.requestSubmit()}
                  />
                  {/* Penutupan administratif kasus terbuka: alasan wajib, pelaku
                      tercatat, riwayat tetap ada (void, bukan hapus). */}
                  <ConfirmAction
                    trigger={
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={!can("returns.complete", capabilities)}
                        title={
                          can("returns.complete", capabilities)
                            ? undefined
                            : "Kamu tidak punya akses menutup kasus retur"
                        }
                      >
                        Tutup kasus (void)
                      </Button>
                    }
                    title="Tutup kasus retur terbuka ini?"
                    description="Kasus dibatalkan secara administratif tanpa menghapus riwayat. Pesanan tetap berstatus Retur Diproses sampai ditangani."
                    confirmLabel="Tutup kasus"
                    reasonLabel="Alasan penutupan (wajib)"
                    reasonPlaceholder="Contoh: salah catat, pelanggan membatalkan pengajuan"
                    reasonRequired
                    onConfirm={(alasan) => submitVoid(item, alasan ?? "")}
                  />
                </div>
              </form>
            </div>
          ) : (
            <div className="mt-3 border-t border-border/60 pt-3 text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold text-foreground">
                  Resolusi:{" "}
                  {RESOLUTION_LABELS[item.resolution_type ?? ""] ?? humanize(item.resolution_type)}
                  {item.resolution_type === "refund" && item.refund_amount
                    ? ` (${formatCurrency(item.refund_amount)})`
                    : null}
                </span>
                {(item.return_shipping_cost ?? 0) > 0 ? (
                  <span className="text-muted-foreground">
                    Ongkir retur toko: {formatCurrency(item.return_shipping_cost)}
                  </span>
                ) : null}
                {item.completed_at ? (
                  <span className="text-muted-foreground">
                    Selesai: {formatDateTime(item.completed_at)}
                  </span>
                ) : null}
              </div>
              {item.resolution_type === "replacement" &&
              item.items?.some((i) => (i.replacement_quantity ?? 0) > 0) ? (
                <div className="mt-2 text-muted-foreground">
                  <p className="font-medium text-foreground">Barang pengganti:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {item.items
                      .filter((i) => (i.replacement_quantity ?? 0) > 0)
                      .map((i) => (
                        <li key={i.id}>
                          {i.name || `Item #${i.order_item_id}`} · {i.replacement_quantity} pcs
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}

              {item.voided_at ? (
                <p className="mt-2 text-xs text-destructive">
                  Kasus di-void {formatDateTime(item.voided_at)}: tidak lagi dihitung laporan.
                  Riwayat nilai tetap tersimpan di kasus ini.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!can("returns.complete", capabilities)}
                    title={
                      can("returns.complete", capabilities)
                        ? undefined
                        : "Kamu tidak punya akses mengoreksi retur"
                    }
                    onClick={() =>
                      editData[item.id]
                        ? setEditData((current) => {
                            const next = { ...current }
                            delete next[item.id]
                            return next
                          })
                        : setEditData((current) => ({
                            ...current,
                            [item.id]: current[item.id] ?? editFormDari(item),
                          }))
                    }
                  >
                    {editData[item.id] ? "Tutup form koreksi" : "Koreksi data"}
                  </Button>
                  {/* Penutupan administratif kasus selesai (void koreksi):
                      riwayat tidak dihapus, hanya berhenti dihitung laporan. */}
                  <ConfirmAction
                    trigger={
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={!can("returns.complete", capabilities)}
                        title={
                          can("returns.complete", capabilities)
                            ? undefined
                            : "Kamu tidak punya akses menutup kasus retur"
                        }
                      >
                        Tutup kasus (void)
                      </Button>
                    }
                    title="Void kasus retur selesai ini?"
                    description="Kasus tetap tercatat dan status pesanan tidak berubah, tetapi nilai refund dan ongkirnya berhenti dihitung di laporan. Tidak ada pembalikan stok atau refund otomatis."
                    confirmLabel="Void kasus"
                    reasonLabel="Alasan void (wajib)"
                    reasonPlaceholder="Contoh: kasus ganda, salah catat pesanan"
                    reasonRequired
                    onConfirm={(alasan) => submitVoid(item, alasan ?? "")}
                  />
                </div>
              )}

              {editData[item.id]
                ? (() => {
                    const d = editData[item.id]
                    const refundBaru = Number(d.refund_amount) || 0
                    const ongkirBaru = Number(d.return_shipping_cost) || 0
                    const dampakNet =
                      -(refundBaru - (item.refund_amount ?? 0)) -
                      (ongkirBaru - (item.return_shipping_cost ?? 0))
                    const dampakTeks =
                      dampakNet === 0
                        ? "tidak berubah"
                        : dampakNet < 0
                          ? `berkurang ${formatCurrency(-dampakNet)}`
                          : `bertambah ${formatCurrency(dampakNet)}`
                    const ringkasan = `Refund ${formatCurrency(item.refund_amount ?? 0)} menjadi ${formatCurrency(refundBaru)}, ongkir retur ${formatCurrency(item.return_shipping_cost ?? 0)} menjadi ${formatCurrency(ongkirBaru)}, dampak Penjualan Bersih ${dampakTeks}.`
                    return (
                      <form
                        className="mt-3 space-y-3 rounded-lg border border-border bg-background p-3"
                        onSubmit={(event) => event.preventDefault()}
                      >
                        <p className="text-xs font-semibold">Koreksi data kasus #{item.id}</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field id={`edit-reason-${item.id}`} label="Alasan retur" required>
                            <Select
                              value={d.reason}
                              onChange={(event) =>
                                setEditData((c) => ({
                                  ...c,
                                  [item.id]: { ...d, reason: event.target.value },
                                }))
                              }
                            >
                              {RETURN_REASONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field id={`edit-fault-${item.id}`} label="Pihak penyebab">
                            <Select
                              value={d.fault_party}
                              onChange={(event) =>
                                setEditData((c) => ({
                                  ...c,
                                  [item.id]: { ...d, fault_party: event.target.value },
                                }))
                              }
                            >
                              <option value="store">Toko</option>
                              <option value="customer">Pelanggan</option>
                              <option value="other">Lainnya</option>
                            </Select>
                          </Field>
                          <Field id={`edit-resolution-${item.id}`} label="Resolusi" required>
                            <Select
                              value={d.resolution_type}
                              onChange={(event) =>
                                setEditData((c) => ({
                                  ...c,
                                  [item.id]: { ...d, resolution_type: event.target.value },
                                }))
                              }
                            >
                              {Object.entries(RESOLUTION_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field
                            id={`edit-refund-${item.id}`}
                            label="Refund"
                            error={
                              bolehRefund ? undefined : "Pesanan belum lunas: refund akan ditolak server."
                            }
                          >
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={d.refund_amount}
                              onChange={(event) =>
                                setEditData((c) => ({
                                  ...c,
                                  [item.id]: { ...d, refund_amount: event.target.value },
                                }))
                              }
                            />
                          </Field>
                          <Field id={`edit-ongkir-${item.id}`} label="Ongkir retur toko">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={d.return_shipping_cost}
                              onChange={(event) =>
                                setEditData((c) => ({
                                  ...c,
                                  [item.id]: { ...d, return_shipping_cost: event.target.value },
                                }))
                              }
                            />
                          </Field>
                          <Field id={`edit-replacement-${item.id}`} label="Nilai penggantian">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={d.replacement_amount}
                              onChange={(event) =>
                                setEditData((c) => ({
                                  ...c,
                                  [item.id]: { ...d, replacement_amount: event.target.value },
                                }))
                              }
                            />
                          </Field>
                        </div>
                        <Field id={`edit-notes-${item.id}`} label="Kronologi pelanggan">
                          <Textarea
                            rows={2}
                            value={d.customer_notes}
                            onChange={(event) =>
                              setEditData((c) => ({
                                ...c,
                                [item.id]: { ...d, customer_notes: event.target.value },
                              }))
                            }
                          />
                        </Field>
                        <p className="text-[11px] text-muted-foreground">
                          Dampak Penjualan Bersih: {dampakTeks}. Perubahan ini hanya memperbarui
                          pencatatan laporan. Transfer refund dilakukan di luar website.
                        </p>
                        {editError ? (
                          <p
                            role="alert"
                            className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                          >
                            {editError}
                          </p>
                        ) : null}
                        <ConfirmAction
                          trigger={
                            <Button
                              type="button"
                              size="sm"
                              disabled={!can("returns.complete", capabilities)}
                              title={
                                can("returns.complete", capabilities)
                                  ? undefined
                                  : "Kamu tidak punya akses mengoreksi retur"
                              }
                            >
                              Simpan koreksi retur
                            </Button>
                          }
                          title="Simpan koreksi retur"
                          description={ringkasan}
                          confirmLabel="Simpan koreksi retur"
                          variant="primary"
                          reasonLabel="Alasan koreksi (wajib)"
                          reasonPlaceholder="Contoh: koreksi nominal sesuai bukti transfer"
                          reasonRequired
                          onConfirm={(alasan) => submitEdit(item, alasan ?? "")}
                        />
                      </form>
                    )
                  })()
                : null}

              {adjustments.filter((a) => a.return_case_id === item.id).length > 0 ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Riwayat koreksi ({adjustments.filter((a) => a.return_case_id === item.id).length})
                  </summary>
                  <ul className="mt-1 space-y-1 pl-4 text-xs text-muted-foreground">
                    {adjustments
                      .filter((a) => a.return_case_id === item.id)
                      .map((a) => (
                        <li key={a.id}>
                          {a.created_at ? formatDateTime(a.created_at) : "-"} ·{" "}
                          {AUDIT_FIELD_LABELS[a.field] ?? a.field}: {a.old_value ?? "-"} menjadi{" "}
                          {a.new_value ?? "-"} oleh {a.actor ?? "sistem"} ({a.reason})
                        </li>
                      ))}
                  </ul>
                </details>
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
