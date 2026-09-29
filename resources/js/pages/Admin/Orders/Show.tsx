import { Head, router, useForm } from "@inertiajs/react"
import * as React from "react"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"

import { SectionCard } from "@/components/admin/section-card"
import { Sheet, SheetContent } from "@/components/admin/ui/sheet"
import { Button } from "@/components/admin/ui/button"
import { CopyButton } from "@/components/admin/ui/copy-button"
import { Card } from "@/components/admin/ui/card"
import { StatusConfirmButton } from "@/components/admin/order-status-confirm"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { ReviewReplyDialog } from "@/components/admin/review-reply-dialog"
import { RETURN_REASONS } from "@/components/admin/order-return-create-form"
import { OrderProductPicker, type PickedOrderProduct } from "@/components/admin/order-product-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/admin/ui/dialog"
import { ORDER_CANCEL_DIALOG } from "@/lib/order-cancel-dialog"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { QuantityInput } from "@/components/admin/ui/quantity-input"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import {
  PrintOrderArea,
  usePrintOrder,
} from "@/components/shared/print-order-customer"
import { ShippingTrackPanel } from "@/components/shared/shipping-track-panel"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency, formatNumber, humanize } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { statusMeta } from "@/lib/status"
import { liveConnectionLabel, useAdminLiveOrders } from "@/lib/admin-live-events"
import { can, useAdminCapabilities } from "@/lib/capabilities"

interface OrderItemRow {
  id: number
  name: string
  product_id?: number
  variant_id?: number | null
  variant_sku?: string | null
  variation_1_name?: string | null
  variation_1_option?: string | null
  variation_2_name?: string | null
  variation_2_option?: string | null
  quantity: number
  unit_price: number
  line_total: number
  note?: string | null
  image?: string | null
}

interface OrderDetail {
  id: number
  order_number: string
  order_status: string
  payment_status: string
  payment_bucket?: string
  payment_label?: string
  shipping_status: string
  payment_method?: string | null
  payment_method_label: string
  cod_flag: boolean
  flow: "cod" | "transfer"
  flow_hint?: string | null
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  shipping_address_line1?: string | null
  shipping_address_line2?: string | null
  shipping_village?: string | null
  shipping_district?: string | null
  shipping_city?: string | null
  shipping_province?: string | null
  shipping_postal_code?: string | null
  notes?: string | null
  admin_notes?: string | null
  subtotal_amount: number
  shipping_amount: number
  jnt_ongkir_assumed?: number
  jnt_ongkir_actual?: number | null
  jnt_ongkir_selisih?: number | null
  jnt_freight_actual?: number | null
  jnt_insured_fee_actual?: number | null
  jnt_chargeable_weight_kg?: number | null
  jnt_cost_synced_at?: string | null
  shipping_subsidy_amount?: number
  shipping_insurance_amount?: number
  discount_amount: number
  voucher_code?: string | null
  voucher_discount_amount?: number
  cod_fee_amount?: number
  total_amount: number
  product_count: number
  unit_count: number
  created_at: string | null
  updated_at: string | null
  whatsapp_url?: string | null
  /** Ulasan pelanggan untuk pesanan ini, bila sudah ada (owner 2026-09-21). */
  testimonial?: {
    id: number
    customer_name: string
    rating?: number | null
    message?: string | null
    location?: string | null
    image_url?: string | null
    source_label?: string | null
    created_at?: string | null
    admin_reply?: string | null
    admin_replied_at?: string | null
    has_reply?: boolean
    can_reply?: boolean
    reply_url?: string
    destroy_reply_url?: string
  } | null
  /** Tautan chat WA berisi naskah template sesuai status pesanan. */
  whatsapp_status_url?: string | null
  items: OrderItemRow[]
  payments: Array<{
    id: number
    evidence_url?: string | null
    payment_method: string
    status: string
    amount: number
    transaction_reference?: string | null
    paid_at?: string | null
  }>
  shipping_records: Array<{
      id: number
      carrier_name?: string | null
      waybill_number?: string | null
      status?: string | null
      status_raw?: string | null
      tracking_url?: string | null
      last_status_at?: string | null
    }>
    return_cases?: ReturnCase[]
  whatsapp_failed_count?: number
    whatsapp_messages: Array<{
      text?: string
      is_automated?: boolean
      time_label?: string | null
      date_label?: string | null
    id: number
    direction: string
    status: string
    internal_template_key?: string | null
    label?: string | null
    phone_number?: string | null
    sent_at?: string | null
    received_at?: string | null
  }>
}

interface PrimaryAction {
  label: string
  next_status: string | null
  kind?: string
  hint?: string | null
  href?: string
}

interface EditPolicy {
  allowed: boolean
  require_note: boolean
  reason: string | null
}

interface ShippingActions {
  createUrl: string
  refreshUrl: string
  jntEnabled: boolean
}

interface TrackingProps {
  shipping_status: string
  carrier_name?: string | null
  waybill_number?: string | null
  record_status?: string | null
  status_raw?: string | null
  last_status_at?: string | null
  tracking_url?: string | null
  order_status?: string
  payment_status?: string
  payment_method?: string | null
  total_amount?: number
  paid?: boolean
  latest_message?: string | null
  latest_at?: string | null
  timeline?: Array<{ message: string; at?: string | null; source?: string }>
}

interface OrderEvent {
  event_type: string
  label?: string
  payload?: Record<string, unknown> | null
  created_at: string | null
  user_id?: number | null
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function variationLabel(item: OrderItemRow): string {
  return [
    item.variation_1_option
      ? `${item.variation_1_name ? `${item.variation_1_name}: ` : ""}${item.variation_1_option}`
      : null,
    item.variation_2_option
      ? `${item.variation_2_name ? `${item.variation_2_name}: ` : ""}${item.variation_2_option}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

function fullAddress(order: OrderDetail): string {
  return [
    order.shipping_address_line1,
    order.shipping_address_line2,
    order.shipping_village,
    order.shipping_district,
    order.shipping_city,
    order.shipping_province,
    order.shipping_postal_code,
  ]
    .filter(Boolean)
    .join(", ")
}

interface EditLine {
  item_id: number | null
  parent_sku: string
  variant_sku: string
  qty: number
  /** Terisi hanya untuk baris baru dari pemilih produk, supaya nama produk dan
      label variannya bisa tampil sebelum pesanan disimpan. */
  name?: string
  variant_label?: string
}

interface EditFormData {
  customer_name: string
  customer_phone: string
  customer_email: string
  address_line1: string
  address_line2: string
  village: string
  district: string
  city: string
  province: string
  postal_code: string
  notes: string
  edit_note: string
  /** Error dari server saat edit ditolak (mis. terkunci karena sudah ada resi). */
  edit?: string
  items: EditLine[]
}

function OrderEditPanel({
  order,
  editUrl,
  requireNote,
  onCancel,
  onCopy,
}: {
  order: OrderDetail
  editUrl: string
  requireNote: boolean
  onCancel: () => void
  /** Penyalin teks dari halaman induk; dipakai tombol salin di baris produk. */
  onCopy: (value: string) => void
}) {
  const [pemilihProdukTerbuka, setPemilihProdukTerbuka] = React.useState(false)
  const [adminNotes, setAdminNotes] = React.useState<string>(order.admin_notes ?? "")
  const [savingAdminNotes, setSavingAdminNotes] = React.useState(false)

  function saveAdminNotes() {
    setSavingAdminNotes(true)
    router.put(
      routeUrl("admin.orders.admin-notes.update", { order: order.id }),
      { admin_notes: adminNotes },
      { preserveScroll: true, onFinish: () => setSavingAdminNotes(false) },
    )
  }

  const form = useForm<EditFormData>({
    customer_name: order.customer_name ?? "",
    customer_phone: order.customer_phone ?? "",
    customer_email: order.customer_email ?? "",
    address_line1: order.shipping_address_line1 ?? "",
    address_line2: order.shipping_address_line2 ?? "",
    village: order.shipping_village ?? "",
    district: order.shipping_district ?? "",
    city: order.shipping_city ?? "",
    province: order.shipping_province ?? "",
    postal_code: order.shipping_postal_code ?? "",
    notes: order.notes ?? "",
    edit_note: "",
    items: order.items.map((item) => ({
      item_id: item.id,
      parent_sku: "",
      variant_sku: "",
      qty: item.quantity,
    })),
  })

  const itemById = React.useMemo(
    () => new Map(order.items.map((item) => [item.id, item])),
    [order.items],
  )

  function setQty(index: number, qty: number) {
    form.setData(
      "items",
      form.data.items.map((line, i) =>
        i === index ? { ...line, qty: Math.max(1, qty) } : line,
      ),
    )
  }

  function removeLine(index: number) {
    form.setData(
      "items",
      form.data.items.filter((_, i) => i !== index),
    )
  }

  function addLine(item: PickedOrderProduct) {
    form.setData("items", [
      ...form.data.items,
      {
        item_id: null,
        parent_sku: item.parent_sku,
        variant_sku: item.variant_sku,
        qty: Math.max(1, item.qty),
        name: item.name,
        variant_label: item.variant_label,
      },
    ])
  }

  function submit() {
    const lines = form.data.items.filter((line) => line.qty >= 1)
    if (lines.length === 0) return
    form.setData("items", lines)
    form.put(editUrl, { preserveScroll: true })
  }

  return (
    <div>
      <FormErrorSummary errors={form.errors} className="mx-5 mt-4" />

      {/* Daftar produk mode edit memakai layout baris yang sama dengan daftar isi
          pesanan: gambar, nama, dan varian. Kontrol jumlah serta tombol hapus
          menyatu di baris yang sama, jadi produknya hanya tampil SEKALI. */}
      <ul className="divide-y divide-border">
        {form.data.items.map((line, index) => {
          const original = line.item_id != null ? itemById.get(line.item_id) : undefined
          const nama = original?.name ?? line.name ?? line.parent_sku
          return (
            <li key={line.item_id ?? `new-${index}`} className="flex items-start gap-3.5 px-5 py-4">
              <div className="size-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                {original?.image ? (
                  <img src={original.image} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <Icon name="image" className="size-4" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-1.5">
                  <p className="text-sm font-normal leading-5 text-foreground">{nama}</p>
                  <button
                    type="button"
                    onClick={() => onCopy(nama)}
                    className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label={`Salin ukuran & nama: ${nama}`}
                    title="Salin ukuran & nama produk"
                  >
                    <Icon name="copy" className="size-3" aria-hidden="true" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {original
                    ? variationLabel(original) || original.variant_sku || "-"
                    : line.variant_label ?? (line.variant_sku || "tanpa varian")}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {original
                    ? `${formatNumber(line.qty)} × ${formatCurrency(original.unit_price)}`
                    : "Harga dihitung ulang saat disimpan"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {original ? (
                  <p className="tabular-nums text-sm font-semibold">
                    {formatCurrency(line.qty * original.unit_price)}
                  </p>
                ) : null}
                <QuantityInput
                  value={line.qty}
                  onChange={(qty) => setQty(index, qty)}
                  ariaLabel={`Jumlah ${nama}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLine(index)}
                  aria-label={`Hapus ${nama} dari pesanan`}
                  title="Hapus produk dari pesanan"
                >
                  <Icon name="x" className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="px-5 py-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setPemilihProdukTerbuka(true)}
        >
          <Icon name="plus" className="size-3" aria-hidden="true" />
          Pilih produk
        </Button>
        <OrderProductPicker
          open={pemilihProdukTerbuka}
          onClose={() => setPemilihProdukTerbuka(false)}
          onPick={addLine}
        />
      </div>

      <div className="space-y-4 border-t border-border bg-muted/30 px-5 py-4">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field id="edit-customer-name" label="Nama penerima" required error={form.errors.customer_name}>
          <Input
            value={form.data.customer_name}
            onChange={(event) => form.setData("customer_name", event.target.value)}
          />
        </Field>
        <Field id="edit-customer-phone" label="Nomor HP" required error={form.errors.customer_phone}>
          <Input
            value={form.data.customer_phone}
            onChange={(event) => form.setData("customer_phone", event.target.value)}
          />
        </Field>
        <Field id="edit-customer-email" label="Email (opsional)" error={form.errors.customer_email}>
          <Input
            value={form.data.customer_email}
            onChange={(event) => form.setData("customer_email", event.target.value)}
          />
        </Field>
        <Field id="edit-address1" label="Alamat" required error={form.errors.address_line1}>
          <Input
            value={form.data.address_line1}
            onChange={(event) => form.setData("address_line1", event.target.value)}
          />
        </Field>
        <Field id="edit-address2" label="Alamat 2 (opsional)" error={form.errors.address_line2}>
          <Input
            value={form.data.address_line2}
            onChange={(event) => form.setData("address_line2", event.target.value)}
          />
        </Field>
        <Field id="edit-village" label="Desa/Kelurahan" error={form.errors.village}>
          <Input
            value={form.data.village}
            onChange={(event) => form.setData("village", event.target.value)}
          />
        </Field>
        <Field id="edit-district" label="Kecamatan" error={form.errors.district}>
          <Input
            value={form.data.district}
            onChange={(event) => form.setData("district", event.target.value)}
          />
        </Field>
        <Field id="edit-city" label="Kota/Kabupaten" required error={form.errors.city}>
          <Input
            value={form.data.city}
            onChange={(event) => form.setData("city", event.target.value)}
          />
        </Field>
        <Field id="edit-province" label="Provinsi" required error={form.errors.province}>
          <Input
            value={form.data.province}
            onChange={(event) => form.setData("province", event.target.value)}
          />
        </Field>
        <Field id="edit-postal" label="Kode pos" required error={form.errors.postal_code}>
          <Input
            value={form.data.postal_code}
            onChange={(event) => form.setData("postal_code", event.target.value)}
          />
        </Field>
      </div>

      <Field id="edit-notes" label="Catatan pesanan (opsional)" error={form.errors.notes}>
        <Textarea
          rows={2}
          value={form.data.notes}
          onChange={(event) => form.setData("notes", event.target.value)}
        />
      </Field>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="mb-2 flex items-center gap-2">
          <Icon name="clipboard-text" className="size-4 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-semibold">Catatan internal admin</p>
        </div>
        <Textarea
          rows={3}
          value={adminNotes}
          onChange={(event) => setAdminNotes(event.target.value)}
          placeholder="Catatan hanya untuk tim admin, tidak terlihat pelanggan."
        />
        <div className="mt-2 flex justify-end gap-2">
          {order.admin_notes?.trim() ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdminNotes("")}>
              Hapus
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={saveAdminNotes} disabled={savingAdminNotes}>
            {savingAdminNotes ? "Menyimpan..." : "Simpan catatan internal"}
          </Button>
        </div>
      </div>

      <Field
        id="edit-note"
        label={requireNote ? "Catatan perubahan (wajib)" : "Catatan perubahan (opsional)"}
        required={requireNote}
        error={form.errors.edit_note || form.errors.edit}
      >
        <Textarea
          rows={2}
          value={form.data.edit_note}
          onChange={(event) => form.setData("edit_note", event.target.value)}
          placeholder="Alasan perubahan isi pesanan - tercatat di riwayat."
        />
      </Field>

      <div className="flex items-center gap-2">
        <Button type="button" onClick={submit} disabled={form.processing}>
          {form.processing ? "Menyimpan..." : "Simpan"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Batal
        </Button>
      </div>
      </div>
    </div>
  )
}

interface ReturnCaseItem {
  id: number
  order_item_id: number
  name?: string | null
  unit_price?: number
  requested_quantity: number
  returned_quantity: number
  replacement_product_id?: number | null
  replacement_variant_id?: number | null
  replacement_quantity?: number | null
}

interface ReturnCase {
  id: number
  status: string
  reason: string
  reason_detail?: string | null
  fault_party?: string | null
  shipping_cost_borne_by_store?: boolean
  resolution_type?: string | null
  customer_notes?: string | null
  admin_notes?: string | null
  refund_amount?: number
  replacement_amount?: number
  return_shipping_cost?: number
  completed_at?: string | null
  /** Retur manual pesanan Selesai (jalur admin khusus 2026-09-28). */
  late_return?: boolean
  override_reason?: string | null
  /** Kasus ditutup administratif (void): tidak dihitung laporan lagi. */
  voided_at?: string | null
  void_reason?: string | null
  items: ReturnCaseItem[]
}

interface ReturnEligibility {
  eligible: boolean
  reason: string | null
  deadline: string | null
  /**
   * Kebijakan resmi yang TIDAK lagi memblokir sejak skema retur full manual
   * (keputusan owner 2026-09-21): batas 48 jam dan status lunas. Ditampilkan
   * sebagai peringatan supaya admin memutuskan dengan sadar, bukan diam-diam
   * dilewati.
   */
  warnings?: string[]
}

/** Satu baris jejak audit koreksi/void kasus retur (tabel return_case_adjustments). */
interface ReturnAdjustment {
  id: number
  return_case_id: number
  field: string
  old_value?: string | null
  new_value?: string | null
  reason: string
  actor?: string | null
  created_at?: string | null
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
function editFormDari(caseItem: ReturnCase) {
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

/**
 * Waktu paket sampai dan batas returnya. `deadline` dihitung backend memakai
 * ReturnService::RETURN_WINDOW_HOURS, jadi ambang jamnya tidak ditulis ulang di
 * klien (dulu 48 jam tersalin di sini dan bisa berbeda dari aturan server).
 */
function returnDeadline(order: OrderDetail, eligibility?: ReturnEligibility): { deliveredAt: string | null; deadline: string | null; expired: boolean } {
  const delivered = order.shipping_records
    ?.filter((r) => r.status === "delivered" && r.last_status_at)
    .sort((a, b) => (b.last_status_at || "").localeCompare(a.last_status_at || ""))[0]
  if (!delivered?.last_status_at) return { deliveredAt: null, deadline: null, expired: false }
  const deadline = eligibility?.deadline ?? null
  return {
    deliveredAt: delivered.last_status_at,
    deadline: deadline ?? delivered.last_status_at,
    expired: deadline ? Date.now() > new Date(deadline).getTime() : false,
  }
}

function ReturnCasePanel({
  order,
  cases,
  eligibility,
  editReturnCaseId,
  returnAdjustments = [],
}: {
  order: OrderDetail
  cases: ReturnCase[]
  eligibility: ReturnEligibility
  /** Kasus yang dibuka lewat deep-link GET .../returns/{returnCase}/edit. */
  editReturnCaseId?: number
  returnAdjustments?: ReturnAdjustment[]
}) {
  const capabilities = useAdminCapabilities()

  const [completion, setCompletion] = React.useState<
    Record<
      number,
      {
        resolution_type: string
        admin_notes: string
        refund_amount: string
        return_shipping_cost: string
        additional_shipping_amount: string
        replacement_items: Array<{ order_item_id: number; product_id: number; variant_id: string; quantity: string; name: string }>
      }
    >
  >({})
  const [editReplacement, setEditReplacement] = React.useState<Record<number, boolean>>({})
  // Kasus retur yang popup penyelesaiannya sedang terbuka (owner 2026-09-29:
  // langkah penyelesaian retur juga lewat popup, bukan form inline).
  const [kasusSelesaiTerbuka, setKasusSelesaiTerbuka] = React.useState<number | null>(null)
  // Deep-link GET .../returns/{returnCase}/edit: kasus tujuan form koreksi,
  // dihitung sebelum state supaya initializer bisa memakainya tanpa effect.
  const idKasusDariUrl = editReturnCaseId ?? 0
  const kasusDariUrl =
    idKasusDariUrl > 0
      ? cases.find((c) => c.id === idKasusDariUrl && c.status === "completed" && !c.voided_at)
      : undefined
  // Koreksi data kasus retur selesai. Form per kasus + galat server.
  // Deep-link dari URL diisi di initializer, bukan di effect.
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
  >(() => (kasusDariUrl ? { [kasusDariUrl.id]: editFormDari(kasusDariUrl) } : {}))
  const [editError, setEditError] = React.useState<string | null>(null)
  const editFormRef = React.useRef<Record<number, HTMLFormElement | null>>({})
  // Galat validasi dari server untuk form penyelesaian. Form ini dikirim
  // dengan router.post mentah (bukan useForm), jadi tanpa penampung ini
  // setiap penolakan server hanya memuat ulang halaman tanpa pesan apa pun
  // dan admin mengira tindakannya berhasil.
  const [completionError, setCompletionError] = React.useState<string | null>(null)
  // Form penyelesaian per kasus retur. Tombol simpannya kini dibungkus dialog
  // konfirmasi, jadi pengiriman dipicu lewat ref ini supaya validasi bawaan
  // peramban (field wajib) tetap berjalan sebelum dialog terbuka.
  const formSelesaiRef = React.useRef<Record<number, HTMLFormElement | null>>({})

  const { deadline, expired } = returnDeadline(order, eligibility)

  function openCompletion(caseItem: ReturnCase) {
    const autoReplace = caseItem.items.map((ci) => {
      const orderItem = order.items.find((oi) => oi.id === ci.order_item_id)
      return {
        order_item_id: ci.order_item_id,
        product_id: orderItem?.product_id ?? 0,
        variant_id: orderItem?.variant_id != null ? String(orderItem.variant_id) : "",
        quantity: String(ci.requested_quantity),
        name: orderItem?.name ?? `Item #${ci.order_item_id}`,
      }
    })
    setCompletion((current) => ({
      ...current,
      [caseItem.id]: current[caseItem.id] ?? {
        resolution_type: "refund",
        admin_notes: "",
        refund_amount: "0",
        return_shipping_cost: "",
        additional_shipping_amount: "",
        replacement_items: autoReplace,
      },
    }))
  }

  function submitComplete(caseItem: ReturnCase) {
    const data = completion[caseItem.id] ?? { resolution_type: "refund", admin_notes: "", refund_amount: "0", return_shipping_cost: "", replacement_items: [] }
    const payload: {
          resolution_type: string
          admin_notes: string
          refund_amount: number
          return_shipping_cost: number
          additional_shipping_amount: number
          returned_items: Array<{ id: number; returned_quantity: number }>
          replacement_items?: Array<{ order_item_id: number; product_id: number; variant_id: number | null; quantity: number }>
        } = {
          resolution_type: data.resolution_type,
          admin_notes: data.admin_notes,
          refund_amount: ["refund", "compensation"].includes(data.resolution_type) ? Number(data.refund_amount) || 0 : 0,
          return_shipping_cost: Number(data.return_shipping_cost) || 0,
          additional_shipping_amount: Number(data.additional_shipping_amount) || 0,
          returned_items: caseItem.items.map((ci) => ({ id: ci.id, returned_quantity: ci.requested_quantity })),
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
    router.post(routeUrl("admin.orders.returns.complete", { order: order.id, returnCase: caseItem.id }), payload, {
      preserveScroll: true,
      onSuccess: () => {
        setKasusSelesaiTerbuka(null)
        setCompletion((current) => {
          const next = { ...current }
          delete next[caseItem.id]
          return next
        })
      },
      onError: (errors) => {
        const pesan = Object.values(errors).filter(Boolean)
        setCompletionError(
          pesan.length > 0
            ? pesan.join(" ")
            : "Penyelesaian retur belum berhasil disimpan. Periksa kembali isian form.",
        )
      },
    })
  }

  // Batas refund yang sah menurut backend: nilai terkecil antara total
  // pesanan dan jumlah pembayaran yang benar-benar sudah dicatat lunas.
  // Batas ini dipakai di layar supaya admin tidak mengisi angka yang akan
  // ditolak server.
  const totalDibayar = (order.payments ?? [])
    .filter((bayar) => bayar.status === "completed")
    .reduce((jumlah, bayar) => jumlah + bayar.amount, 0)
  const maksRefund =
    totalDibayar > 0 ? Math.min(order.total_amount, totalDibayar) : order.total_amount
  const bolehRefund = order.payment_status === "paid"
  const showCreate = eligibility?.eligible === true

  /** Buka form koreksi untuk kasus selesai, diisi nilai kasus saat ini. */
  function openEdit(caseItem: ReturnCase) {
    setEditError(null)
    setEditData((current) => ({
      ...current,
      [caseItem.id]: current[caseItem.id] ?? editFormDari(caseItem),
    }))
  }

  /** Simpan koreksi lewat PATCH; alasan koreksi datang dari dialog konfirmasi. */
  function submitEdit(caseItem: ReturnCase, adjustmentReason: string) {
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
  function submitVoid(caseItem: ReturnCase, alasan: string) {
    router.post(
      routeUrl("admin.orders.returns.void", { order: order.id, returnCase: caseItem.id }),
      { void_reason: alasan },
      { preserveScroll: true },
    )
  }

  return (
    <div id="return-case" className="mt-4">
      <SectionCard title="Retur & penyelesaian">
        <div className="space-y-4">
          {deadline ? (
            <p className={`text-xs ${expired ? "text-destructive" : "text-muted-foreground"}`}>
              Waktu sampai: {new Date(deadline).toLocaleString("id-ID")} · Batas retur 48 jam.
              {expired ? " Batas retur telah lewat. Tindak lanjuti melalui WhatsApp." : ` Deadline: ${new Date(deadline).toLocaleString("id-ID")}`}
            </p>
          ) : null}

          {order.order_status === "delivered" && !showCreate ? (
            <p className="text-xs text-destructive">
              {eligibility?.reason || "Retur tidak dapat dicatat sekarang."}
            </p>
          ) : null}

          {cases.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  Kasus #{item.id} · {item.reason}{item.reason === "lainnya" && item.reason_detail ? ` - ${item.reason_detail}` : ""}
                  {item.late_return ? (
                    <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Retur manual</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2">
                  {item.voided_at ? (
                    <span className="rounded-full border border-destructive/30 px-2 py-0.5 text-[11px] font-medium text-destructive">Di-void</span>
                  ) : null}
                  <StatusBadge status={item.status} />
                </span>
              </div>
              {item.customer_notes ? <p className="mt-2 text-xs text-muted-foreground">{item.customer_notes}</p> : null}
              {item.admin_notes ? <p className="mt-1 text-xs text-muted-foreground">Catatan admin: {item.admin_notes}</p> : null}
              {item.fault_party ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Pihak penyebab: {item.fault_party === "store" ? "Toko" : item.fault_party === "customer" ? "Pelanggan" : "Lainnya"} ·{" "}
                  Ongkir ditanggung toko: {item.shipping_cost_borne_by_store ? "Ya" : "Tidak"}
                </p>
              ) : null}
              {item.status === "open" ? (
                <div className="mt-3 border-t border-border pt-3">
                  {completion[item.id] ? (
                    <Dialog open={kasusSelesaiTerbuka === item.id} onOpenChange={(next) => (next ? undefined : setKasusSelesaiTerbuka(null))}>
                      <DialogContent className="w-[min(calc(100vw-2rem),56rem)] bg-card text-card-foreground">
                        <DialogTitle>Selesaikan retur kasus #{item.id}</DialogTitle>
                        <DialogDescription>
                          Resolusi dan nilai penyelesaian dikunci setelah disimpan, pesanan berpindah ke Retur Selesai.
                        </DialogDescription>
                        <div className="max-h-[70vh] overflow-y-auto pr-1">
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
                            value={completion[item.id].resolution_type}
                            onChange={(event) =>
                              setCompletion((current) => ({
                                ...current,
                                [item.id]: { ...current[item.id], resolution_type: event.target.value },
                              }))
                            }
                          >
                            {/* Refund hanya sah untuk pesanan lunas (kontrak
                                retur): uang yang tidak pernah diterima tidak
                                boleh dikembalikan. Aturannya ditegakkan backend;
                                di sini ditampilkan supaya admin tidak memilih
                                resolusi yang pasti ditolak. */}
                            <option value="refund" disabled={!bolehRefund}>
                              Refund{bolehRefund ? "" : " (pesanan belum lunas)"}
                            </option>
                            <option value="replacement">Ganti barang</option>
                            <option value="reship">Kirim ulang</option>
                            <option value="compensation">Kompensasi</option>
                            <option value="no_compensation">Tanpa kompensasi</option>
                          </Select>
                        </Field>
                        <Field id={`return-completion-note-${item.id}`} label="Catatan penyelesaian" required className="sm:col-span-2">
                          <Textarea
                            rows={2}
                            value={completion[item.id].admin_notes}
                            onChange={(event) =>
                              setCompletion((current) => ({
                                ...current,
                                [item.id]: { ...current[item.id], admin_notes: event.target.value },
                              }))
                            }
                          />
                        </Field>
                      </div>

                      {["refund", "compensation"].includes(completion[item.id].resolution_type) ? (
                        <Field
                          id={`return-refund-${item.id}`}
                          label={completion[item.id].resolution_type === "refund" ? "Refund Retur" : "Nominal Kompensasi"}
                          required>
                          <Input
                            type="number"
                            min="0"
                            max={maksRefund}
                            value={completion[item.id].refund_amount}
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

                      {["replacement", "reship"].includes(completion[item.id].resolution_type) ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold">Barang pengganti (terkunci default)</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setEditReplacement((current) => ({ ...current, [item.id]: !current[item.id] }))
                              }
                            >
                              {editReplacement[item.id] ? "Kunci item" : "Ubah item pengganti"}
                            </Button>
                          </div>
                          {completion[item.id].replacement_items.map((r, idx) => (
                            <div key={r.order_item_id} className="flex items-center gap-2 text-xs">
                              <span className="min-w-0 flex-1 truncate">{r.name}</span>
                              {editReplacement[item.id] ? (
                                <>
                                  <QuantityInput
                                    value={Number(r.quantity) || 1}
                                    ariaLabel={`Jumlah barang pengganti ${r.name}`}
                                    onChange={(qty) =>
                                      setCompletion((current) => ({
                                        ...current,
                                        [item.id]: {
                                          ...current[item.id],
                                          replacement_items: current[item.id].replacement_items.map((rr, i) =>
                                            i === idx ? { ...rr, quantity: String(qty) } : rr
                                          ),
                                        },
                                      }))
                                    }
                                  />
                                </>
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
                          value={completion[item.id].return_shipping_cost}
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
                        hint="Tagihan perjalanan balik dari J&T bila ada; tercatat di export pesanan. Kosongkan bila tidak ada.">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={completion[item.id].additional_shipping_amount}
                          onChange={(event) =>
                            setCompletion((current) => ({
                              ...current,
                              [item.id]: { ...current[item.id], additional_shipping_amount: event.target.value },
                            }))
                          }
                        />
                      </Field>

                      {completionError ? (
                        <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                          {completionError}
                        </p>
                      ) : null}
                      {/* Penyelesaian retur bersifat terminal: kasus dikunci,
                          pesanan masuk Retur Selesai, stok pengganti dipotong,
                          dan pembayaran menggantung dibatalkan. Pola repo
                          memakai ConfirmAction untuk aksi ireversibel, jadi
                          tombol simpan pun dikonfirmasi lebih dulu. */}
                      <ConfirmAction
                        trigger={
                          <Button
                            type="button"
                            size="sm"
                            disabled={!can("returns.complete", capabilities)}
                            title={can("returns.complete", capabilities) ? undefined : "Kamu tidak punya akses menyelesaikan retur"}
                          >
                            Tandai retur selesai
                          </Button>
                        }
                        title="Selesaikan kasus retur ini?"
                        description="Kasus retur dikunci dan pesanan berpindah ke Retur Selesai. Tindakan ini tidak bisa dibatalkan atau diulang."
                        confirmLabel="Tandai retur selesai"
                        onConfirm={() => formSelesaiRef.current[item.id]?.requestSubmit()}
                      />
                    </form>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          openCompletion(item)
                          setKasusSelesaiTerbuka(item.id)
                        }}
                      >
                        Selesaikan retur
                      </Button>
                      {/* Penutupan administratif kasus terbuka: alasan wajib,
                          pelaku tercatat, riwayat tetap ada (void, bukan hapus). */}
                      <ConfirmAction
                        trigger={
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={!can("returns.complete", capabilities)}
                            title={can("returns.complete", capabilities) ? undefined : "Kamu tidak punya akses menutup kasus retur"}
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
                  )}
                </div>
              ) : (
                <div className="mt-3 border-t border-border/60 pt-3 text-xs">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-semibold text-foreground">
                      Resolusi: {RESOLUTION_LABELS[item.resolution_type ?? ""] ?? humanize(item.resolution_type)}
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
                  {item.resolution_type === "replacement" && item.items?.some((i) => (i.replacement_quantity ?? 0) > 0) ? (
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
                      Kasus di-void {item.voided_at ? formatDateTime(item.voided_at) : ""}: tidak lagi dihitung laporan. Riwayat nilai tetap tersimpan di kasus ini.
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!can("returns.complete", capabilities)}
                        title={can("returns.complete", capabilities) ? undefined : "Kamu tidak punya akses mengoreksi retur"}
                        onClick={() =>
                          editData[item.id]
                            ? setEditData((current) => {
                                const next = { ...current }
                                delete next[item.id]
                                return next
                              })
                            : openEdit(item)
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
                            title={can("returns.complete", capabilities) ? undefined : "Kamu tidak punya akses menutup kasus retur"}
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

                  {editData[item.id] ? (() => {
                    const d = editData[item.id]
                    const refundBaru = Number(d.refund_amount) || 0
                    const ongkirBaru = Number(d.return_shipping_cost) || 0
                    const dampakNet =
                      -(refundBaru - (item.refund_amount ?? 0)) - (ongkirBaru - (item.return_shipping_cost ?? 0))
                    const dampakTeks =
                      dampakNet === 0
                        ? "tidak berubah"
                        : dampakNet < 0
                          ? `berkurang ${formatCurrency(-dampakNet)}`
                          : `bertambah ${formatCurrency(dampakNet)}`
                    const ringkasan = `Refund ${formatCurrency(item.refund_amount ?? 0)} menjadi ${formatCurrency(refundBaru)}, ongkir retur ${formatCurrency(item.return_shipping_cost ?? 0)} menjadi ${formatCurrency(ongkirBaru)}, dampak Penjualan Bersih ${dampakTeks}.`
                    return (
                      <form
                        ref={(node) => {
                          editFormRef.current[item.id] = node
                        }}
                        className="mt-3 space-y-3 rounded-lg border border-border bg-background p-3"
                        onSubmit={(event) => event.preventDefault()}
                      >
                        <p className="text-xs font-semibold">Koreksi data kasus #{item.id}</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field id={`edit-reason-${item.id}`} label="Alasan retur" required>
                            <Select
                              value={d.reason}
                              onChange={(event) => setEditData((c) => ({ ...c, [item.id]: { ...d, reason: event.target.value } }))}
                            >
                              {RETURN_REASONS.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </Select>
                          </Field>
                          <Field id={`edit-fault-${item.id}`} label="Pihak penyebab">
                            <Select
                              value={d.fault_party}
                              onChange={(event) => setEditData((c) => ({ ...c, [item.id]: { ...d, fault_party: event.target.value } }))}
                            >
                              <option value="store">Toko</option>
                              <option value="customer">Pelanggan</option>
                              <option value="other">Lainnya</option>
                            </Select>
                          </Field>
                          <Field id={`edit-resolution-${item.id}`} label="Resolusi" required>
                            <Select
                              value={d.resolution_type}
                              onChange={(event) => setEditData((c) => ({ ...c, [item.id]: { ...d, resolution_type: event.target.value } }))}
                            >
                              {Object.entries(RESOLUTION_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </Select>
                          </Field>
                          <Field
                            id={`edit-refund-${item.id}`}
                            label="Refund"
                            error={bolehRefund ? undefined : "Pesanan belum lunas: refund akan ditolak server."}
                          >
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={d.refund_amount}
                              onChange={(event) => setEditData((c) => ({ ...c, [item.id]: { ...d, refund_amount: event.target.value } }))}
                            />
                          </Field>
                          <Field id={`edit-ongkir-${item.id}`} label="Ongkir retur toko">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={d.return_shipping_cost}
                              onChange={(event) => setEditData((c) => ({ ...c, [item.id]: { ...d, return_shipping_cost: event.target.value } }))}
                            />
                          </Field>
                          <Field id={`edit-replacement-${item.id}`} label="Nilai penggantian">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={d.replacement_amount}
                              onChange={(event) => setEditData((c) => ({ ...c, [item.id]: { ...d, replacement_amount: event.target.value } }))}
                            />
                          </Field>
                        </div>
                        <Field id={`edit-notes-${item.id}`} label="Kronologi pelanggan">
                          <Textarea
                            rows={2}
                            value={d.customer_notes}
                            onChange={(event) => setEditData((c) => ({ ...c, [item.id]: { ...d, customer_notes: event.target.value } }))}
                          />
                        </Field>
                        <p className="text-[11px] text-muted-foreground">
                          Dampak Penjualan Bersih: {dampakTeks}. Perubahan ini hanya memperbarui pencatatan laporan. Transfer refund dilakukan di luar website.
                        </p>
                        {editError ? (
                          <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                            {editError}
                          </p>
                        ) : null}
                        <ConfirmAction
                          trigger={
                            <Button
                              type="button"
                              size="sm"
                              disabled={!can("returns.complete", capabilities)}
                              title={can("returns.complete", capabilities) ? undefined : "Kamu tidak punya akses mengoreksi retur"}
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
                  })() : null}

                  {returnAdjustments.filter((a) => a.return_case_id === item.id).length > 0 ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        Riwayat koreksi ({returnAdjustments.filter((a) => a.return_case_id === item.id).length})
                      </summary>
                      <ul className="mt-1 space-y-1 pl-4 text-xs text-muted-foreground">
                        {returnAdjustments
                          .filter((a) => a.return_case_id === item.id)
                          .map((a) => (
                            <li key={a.id}>
                              {a.created_at ? formatDateTime(a.created_at) : "-"} · {AUDIT_FIELD_LABELS[a.field] ?? a.field}:{" "}
                              {a.old_value ?? "-"} menjadi {a.new_value ?? "-"} oleh {a.actor ?? "sistem"} ({a.reason})
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
      </SectionCard>
    </div>
  )
}

/**
 * Istilah status untuk PESAN WhatsApp.
 *
 * Peta status bersama (lib/status) memakai kosakata pesanan: 'pending' di sana
 * berarti menunggu pembayaran dan 'delivered' berarti barang sampai. Kalau
 * dipakai untuk pesan, labelnya jadi menyesatkan, sehingga pesan pelanggan
 * berbunyi 'Menunggu pembayaran'. Peta kecil ini memakai istilah pengiriman
 * pesan yang benar.
 */
const WA_MESSAGE_STATUS: Record<string, { icon: string; title: string; label: string; className: string }> = {
  pending: { icon: "clock", title: "Menunggu tanda kirim", label: "Menunggu", className: "text-muted-foreground" },
  queued: { icon: "clock", title: "Menunggu dikirim", label: "Antre", className: "text-muted-foreground" },
  sent: { icon: "check", title: "Terkirim ke WhatsApp", label: "Terkirim", className: "text-emerald-500 font-medium" },
  delivered: { icon: "checks", title: "Sampai di HP pelanggan", label: "Terkirim", className: "text-emerald-500 font-medium" },
  read: { icon: "checks", title: "Dibaca pelanggan", label: "Dibaca", className: "text-sky-400 font-medium" },
  failed: { icon: "x", title: "Gagal terkirim", label: "Gagal", className: "text-destructive font-medium" },
  received: { icon: "arrow-down-left", title: "Diterima", label: "Diterima", className: "text-emerald-500 font-medium" },
}

function waMessageStatus(status: string) {
  return WA_MESSAGE_STATUS[status] ?? null
}

export default function OrderShow({
  order,
  events = [],
  tracking,
  primaryAction,
  secondaryAction,
  updateStatusUrl,
  adminNotesUrl,
  shippingActions,
  workflowLinks: _workflowLinks,
  editPolicy,
  editUrl,
    returnCases = [],
    returnEligibility,
    editReturnCaseId = 0,
    returnAdjustments = [],
    openTracking = false,
  }: {
    order: OrderDetail
    events?: OrderEvent[]
    tracking?: TrackingProps
    primaryAction: PrimaryAction | null
    secondaryAction?: PrimaryAction | null
    updateStatusUrl: string
    adminNotesUrl?: string
    shippingActions: ShippingActions
    workflowLinks: Array<{ label: string; href: string }>
    editPolicy?: EditPolicy | null
    editUrl?: string
    returnCases?: ReturnCase[]
    returnEligibility?: ReturnEligibility | null
    editReturnCaseId?: number
    returnAdjustments?: ReturnAdjustment[]
    /** Buka drawer Lacak Pesanan sejak render (deep-link `?lacak=1`). */
    openTracking?: boolean
  }) {
  const isCod = order.flow === "cod" || order.cod_flag
  const statusForm = useForm({ order_status: order.order_status })
  const [statusBusy, setStatusBusy] = React.useState(false)

  const shippingForm = useForm({
    waybill_number: "",
  })
  // Popup input resi: form + ringkasan verifikasi alamat/pelanggan.
  // Sistem tidak menilai benar/salah; admin yang memastikan lalu menyimpan.
  const [resiOpen, setResiOpen] = React.useState(false)
  // Popup balas ulasan pelanggan, dipakai tombol Balas di baris aksi.
  const [reviewReplyOpen, setReviewReplyOpen] = React.useState(false)
  // Drawer Lacak Pesanan: dibuka tombol di kartu Detail pengiriman, atau
  // langsung sejak render bila datang dari deep-link `?lacak=1` (daftar
  // Pengiriman dan URL resi lama yang halamannya sudah dihapus).
  const [trackingOpen, setTrackingOpen] = React.useState(openTracking)
  const [refreshBusy, setRefreshBusy] = React.useState(false)
  const [resendWaBusy, setResendWaBusy] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [detailDrawer, setDetailDrawer] = React.useState<null | "riwayat" | "status" | "wa">(null)
  const waLogRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const el = waLogRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [order.whatsapp_messages.length])
  const { printing, handlePrint } = usePrintOrder()
  const capabilities = useAdminCapabilities()
  const [liveChangedNotice, setLiveChangedNotice] = React.useState<string | null>(null)
  const { state: liveState, lastEventAt } = useAdminLiveOrders({
    onOrderUpdated: (event) => {
      if (event.order_id === order.id) {
        // Jangan timpa form yang sedang diedit; tampilkan notice + Refresh manual.
        setLiveChangedNotice(
          "Pesanan diperbarui oleh aktivitas lain. Perbarui setelah menyimpan pekerjaan Anda.",
        )
      }
    },
  })

  const [notesModalOpen, setNotesModalOpen] = React.useState(false)
  const [notesMode, setNotesMode] = React.useState<"view" | "edit">(order.admin_notes?.trim() ? "view" : "edit")
  const [notesText, setNotesText] = React.useState(order.admin_notes ?? "")
  const [notesBusy, setNotesBusy] = React.useState(false)
  const [expandedWaIds, setExpandedWaIds] = React.useState<Set<number>>(new Set())

  function toggleWaExpand(id: number) {
    setExpandedWaIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function saveAdminNotes(content: string) {
    if (!adminNotesUrl) return
    setNotesBusy(true)
    router.put(
      adminNotesUrl,
      { admin_notes: content },
      {
        preserveScroll: true,
        onSuccess: () => {
          setNotesBusy(false)
          setNotesModalOpen(false)
          if (content.trim()) {
            setNotesMode("view")
          } else {
            setNotesMode("edit")
          }
        },
        onError: () => setNotesBusy(false),
        onFinish: () => setNotesBusy(false),
      },
    )
  }

  function deleteAdminNotes() {
    saveAdminNotes("")
  }

  function updateStatus(next?: string, cancelReason?: string) {
    const nextStatus = next ?? statusForm.data.order_status
    statusForm.setData("order_status", nextStatus)
    setStatusBusy(true)
    router.put(
      updateStatusUrl,
      {
        order_status: nextStatus,
        ...(nextStatus === "cancelled" && cancelReason ? { cancel_reason: cancelReason } : {}),
      },
      {
        preserveScroll: true,
        onFinish: () => setStatusBusy(false),
      },
    )
  }

  function runPrimary() {
    if (primaryAction?.kind === "input_resi") {
      setResiOpen(true)
      return
    }
    if (!primaryAction?.next_status) return
    updateStatus(primaryAction.next_status)
  }

  function storeShipping(event: React.FormEvent) {
    event.preventDefault()
    shippingForm.post(shippingActions.createUrl, {
      preserveScroll: true,
      onSuccess: () => setResiOpen(false),
    })
  }

  function refreshShipping() {
    setRefreshBusy(true)
    router.post(
      shippingActions.refreshUrl,
      {},
      {
        preserveScroll: true,
        onFinish: () => setRefreshBusy(false),
      },
    )
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // ignore
    }
  }

  const latestShipping =
    order.shipping_records.find((row) => row.status !== "cancelled") ??
    order.shipping_records[0] ??
    null

  const pageActions = (
    <div className="flex flex-wrap items-center gap-2">
      {(order.whatsapp_failed_count ?? 0) > 0 ? (
        <Button
          variant="destructive"
          size="sm"
          className="shrink-0"
          disabled={resendWaBusy}
          onClick={() => {
            setResendWaBusy(true)
            router.post(
              routeUrl("admin.orders.whatsapp.resend", { order: order.id }),
              {},
              { preserveScroll: true, onFinish: () => setResendWaBusy(false) },
            )
          }}
          title="Ada pemberitahuan status pesanan yang gagal terkirim. Tekan untuk kirim ulang lewat gateway."
        >
          Kirim ulang WA ({order.whatsapp_failed_count})
        </Button>
      ) : order.whatsapp_status_url || order.whatsapp_url ? (
        <Button asChild variant="secondary" size="sm" className="shrink-0">
          <a
            href={order.whatsapp_status_url || order.whatsapp_url || "#"}
            target="_blank"
            rel="noreferrer"
            title="Chat WhatsApp pelanggan dengan naskah sesuai status pesanan"
          >
            <Icon name="whatsapp" className="size-3.5 text-success" aria-hidden="true" />
            Chat WA
          </a>
        </Button>
      ) : null}
      {order.testimonial && order.testimonial.can_reply && (order.order_status === "delivered" || order.order_status === "completed") ? (
        <Button variant="secondary" size="sm" className="shrink-0" onClick={() => setReviewReplyOpen(true)}>
          <Icon name="chat-circle" className="size-3.5" aria-hidden="true" />
          {order.testimonial.has_reply ? "Edit balasan ulasan" : "Balas ulasan"}
        </Button>
      ) : null}
      {secondaryAction?.href ? (
        <Button
          asChild
          variant={secondaryAction.kind === "start_return" ? "destructive" : "secondary"}
          size="sm"
          className="shrink-0"
        >
          <a href={secondaryAction.href}>{secondaryAction.label}</a>
        </Button>
      ) : null}
      {secondaryAction?.next_status ? (
        <StatusConfirmButton
          action={secondaryAction}
          totalAmount={order.total_amount}
          busy={statusBusy}
          size="sm"
          variant="secondary"
          className="shrink-0"
          onConfirm={() => updateStatus(secondaryAction.next_status!)}
        />
      ) : null}
      {primaryAction?.next_status ? (
        <StatusConfirmButton
          action={primaryAction}
          totalAmount={order.total_amount}
          busy={statusBusy}
          size="sm"
          disabled={!can("orders.process", capabilities)}
          titleAttr={can("orders.process", capabilities) ? undefined : "Kamu tidak punya akses memproses pesanan"}
          className="shrink-0"
          onConfirm={runPrimary}
        />
      ) : null}
      {order.order_status === "awaiting_confirmation" || order.order_status === "processing" ? (
        can("orders.cancel", capabilities) ? (
          <ConfirmAction
            trigger={
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                Batalkan pesanan
              </Button>
            }
            title={ORDER_CANCEL_DIALOG.title}
            description={ORDER_CANCEL_DIALOG.description}
            confirmLabel={ORDER_CANCEL_DIALOG.confirmLabel}
            processing={statusBusy}
            reasonLabel={ORDER_CANCEL_DIALOG.reasonLabel}
            reasonPlaceholder={ORDER_CANCEL_DIALOG.reasonPlaceholder}
            onConfirm={(reason) => updateStatus("cancelled", reason)}
          />
        ) : null
      ) : null}
    </div>
  )

  return (
    <AdminLayout
      title={`Pesanan ${order.order_number}`}
      description={order.customer_name}
      actions={pageActions}
      backUrl={routeUrl("admin.orders.index")}
    >
      <Head title={`Pesanan ${order.order_number} | Admin`} />

      {/* Pengingat COD: uang ada di kurir sampai disetorkan ke toko, jadi
          peringatan ini wajib paling atas supaya terlihat segera. */}
      {isCod && order.order_status === "delivered" ? (
        <div className="mb-4 rounded-lg border border-warning/25 bg-warning/10 px-5 py-3">
          <p className="text-xs leading-5 text-warning-foreground">
            Paket diterima. Pastikan pembayaran COD sudah disetorkan oleh kurir.
          </p>
        </div>
      ) : null}

      {/* Ringkasan order - 4 sel proporsional: Nomor order, Pembayaran, Detail penerima, Detail pengiriman */}
      <Card className="grid gap-px overflow-hidden bg-border sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-card p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Nomor order</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <p className="font-mono text-xl font-bold tracking-tight text-foreground">{order.order_number}</p>
              <button
                type="button"
                onClick={() => copyText(order.order_number)}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label="Salin nomor order"
                title="Salin nomor order"
              >
                <Icon name="copy" className="size-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-2">
              <StatusBadge status={order.order_status} />
            </div>
          </div>

          <div className="mt-3 border-t border-border/60 pt-2.5">
            {order.admin_notes?.trim() ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Catatan admin:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNotesMode("edit")
                      setNotesText(order.admin_notes ?? "")
                      setNotesModalOpen(true)
                    }}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <div
                  onClick={() => {
                    setNotesMode("view")
                    setNotesText(order.admin_notes ?? "")
                    setNotesModalOpen(true)
                  }}
                  className="cursor-pointer rounded-md border border-amber-500/25 bg-amber-500/10 p-2 transition hover:bg-amber-500/15"
                  title="Klik untuk melihat catatan lengkap"
                >
                  <p className="line-clamp-2 overflow-hidden text-xs leading-snug text-amber-900 dark:text-amber-200 break-all break-words">
                    {order.admin_notes}
                  </p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setNotesMode("edit")
                  setNotesText("")
                  setNotesModalOpen(true)
                }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Icon name="plus" className="size-3" aria-hidden="true" />
                <span>Catatan Admin</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Pembayaran</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{order.payment_method_label}</span>
            <span className="inline-flex min-h-6 items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
              {order.payment_label || statusMeta(order.payment_status).label}
            </span>
          </div>
          {order.payments?.[0] ? (
            <div className="mt-2 space-y-0.5 text-[13px]">
              <p className="tabular-nums font-semibold text-foreground">
                {formatCurrency(order.payments[0].amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(order.payments[0].paid_at)}
              </p>
              {order.payments[0].evidence_url ? (
                <a
                  href={order.payments[0].evidence_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Lihat bukti transfer
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Detail penerima</p>
          <p className="mt-1.5 text-sm font-semibold text-foreground">{order.customer_name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{order.customer_phone || "-"}</p>
          <p className="mt-1.5 text-[13px] leading-5 text-foreground">
            {fullAddress(order) || "-"}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => copyText(fullAddress(order))}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Icon name="copy" className="size-3" aria-hidden="true" />
              Salin
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Icon name="printer" className="size-3" aria-hidden="true" />
              Cetak
            </button>
          </div>
        </div>

        <div className="bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Detail pengiriman</p>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
            <span className="text-sm font-semibold text-foreground">
              {latestShipping?.carrier_name || (latestShipping?.waybill_number ? "J&T Cargo" : "Pengiriman")}
            </span>
            <StatusBadge
              status={
                latestShipping?.status ||
                (order.order_status === "awaiting_confirmation" || order.order_status === "pending"
                  ? order.order_status
                  : order.shipping_status || "tracking_pending")
              }
            />
          </div>

          <div className="mt-2 space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">No. Resi:</span>
              {latestShipping?.waybill_number ? (
                <div className="inline-flex items-center gap-1">
                  <span className="font-mono font-medium text-foreground">{latestShipping.waybill_number}</span>
                  <CopyButton text={latestShipping.waybill_number} label="Salin nomor resi" />
                </div>
              ) : (
                <span className="text-muted-foreground">Belum ada resi</span>
              )}
            </div>
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => setTrackingOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Icon name="truck" className="size-3.5" aria-hidden="true" />
              <span>Lacak pesanan</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Aksi utama */}
      {liveChangedNotice ? (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/25 bg-warning/5 px-3 py-2 text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-2">
            <Icon name="info" className="size-3.5 shrink-0 text-warning" aria-hidden="true" />
            {liveChangedNotice}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setLiveChangedNotice(null)}
              className="rounded-md border border-border bg-surface px-2 py-1 font-semibold text-foreground transition hover:bg-muted"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={() => router.get(window.location.pathname, {}, { preserveScroll: true })}
              className="rounded-md border border-border bg-surface px-2 py-1 font-semibold text-foreground transition hover:bg-muted"
            >
              Perbarui
            </button>
          </div>
        </div>
      ) : null}
      

      {/* Popup input resi: form + verifikasi alamat & pelanggan.
          Sistem tidak menilai benar/salah; admin memastikan data sebelum menyimpan. */}
      <DialogPrimitive.Root open={resiOpen} onOpenChange={setResiOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-[70] flex max-h-[min(90dvh,38rem)] w-[min(calc(100%-2rem),32rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl duration-200",
              "data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95",
            )}
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className="sr-only">Input nomor resi</DialogPrimitive.Title>

            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Input Resi Pengiriman</h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  Pesanan {order.order_number} · {order.customer_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResiOpen(false)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Tutup popup resi"
              >
                <Icon name="x" className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <section className="rounded-lg border border-border bg-surface/80 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground inline-flex items-center gap-1.5">
                    <Icon name="user" className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    Detail Penerima & Alamat
                  </span>
                </div>

                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                  <span className="text-muted-foreground">Penerima:</span>
                  <span className="font-medium text-foreground">
                    {order.customer_name}
                    {order.customer_phone ? (
                      order.whatsapp_url ? (
                        <a
                          href={order.whatsapp_url}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-1.5 inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-success"
                          title="Buka WhatsApp penerima"
                        >
                          <Icon name="whatsapp" className="size-3 text-success" aria-hidden="true" />
                          <span className="underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-success">{order.customer_phone}</span>
                        </a>
                      ) : (
                        <span className="ml-1 font-mono">({order.customer_phone})</span>
                      )
                    ) : " (-)"}
                  </span>
                  <span className="text-muted-foreground align-top">Alamat:</span>
                  <span className="font-medium leading-5 text-foreground">{fullAddress(order) || "-"}</span>
                </div>
              </section>

              <form onSubmit={storeShipping} className="space-y-4">
                <FormErrorSummary errors={shippingForm.errors} />

                <Field id="popup-waybill" label="Nomor Resi J&T Cargo" required error={shippingForm.errors.waybill_number}>
                  <Input
                    value={shippingForm.data.waybill_number}
                    onChange={(event) => shippingForm.setData("waybill_number", event.target.value)}
                    placeholder="Masukan Resi Pengiriman..."
                  />
                </Field>

                <p className="rounded-md border border-border bg-surface/80 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  Biaya J&T Cargo diisi otomatis dari pelacakan resi, jadi tidak perlu
                  diketik. Setelah resi disimpan, tekan Refresh J&T bila angkanya belum
                  muncul.
                </p>

                

                <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setResiOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={shippingForm.processing}
                  >
                    {shippingForm.processing ? "Menyimpan..." : "Simpan Resi"}
                  </Button>
                </div>
              </form>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Riwayat - 3 kolom */}
      <section className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <SectionCard
          title="Riwayat pesanan"
          action={
            <Button type="button" variant="secondary" size="sm" onClick={() => setDetailDrawer("riwayat")}>
              Detail
            </Button>
          }
          contentClassName="h-[420px] overflow-y-auto"
        >
          <ol className="space-y-2.5 text-[13px]">
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">Waktu pemesanan</span>
              <span className="font-medium">{formatDateTime(order.created_at)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">Update terakhir</span>
              <span className="font-medium">{formatDateTime(order.updated_at)}</span>
            </li>
            {liveState !== "unavailable" && liveState !== "connected" ? (
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Pembaruan langsung</span>
                <span className="font-medium text-warning">{liveConnectionLabel(liveState)}</span>
              </li>
            ) : null}
            {lastEventAt ? (
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Event terakhir</span>
                <span className="font-medium">{formatDateTime(lastEventAt)}</span>
              </li>
            ) : null}
          </ol>
        </SectionCard>
        <SectionCard
          title="Log perubahan status"
          action={
            <Button type="button" variant="secondary" size="sm" onClick={() => setDetailDrawer("status")}>
              Detail
            </Button>
          }
          contentClassName="h-[420px] overflow-y-auto"
        >
          {events.length ? (
            <ul className="space-y-2.5 text-[13px]">
              {events.map((event, index) => (
                <li
                  key={`${event.event_type}-${index}`}
                  className="border-b border-border pb-2.5 last:border-0 last:pb-0"
                >
                  <p className="font-medium">{event.label || humanize(event.event_type)}</p>
                  {typeof event.payload?.reason === "string" && event.payload.reason ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Alasan: {event.payload.reason}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(event.created_at)}
                  </p>
                </li>
              ))}
            
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Belum ada log status.</p>
          )}
        </SectionCard>
        <div id="percakapan-whatsapp" className="scroll-mt-20">
        <SectionCard
          title="Log WhatsApp"
          action={
            <Button type="button" variant="secondary" size="sm" onClick={() => setDetailDrawer("wa")}>
              Detail
            </Button>
          }
          contentClassName="h-[420px] overflow-hidden p-0"
        >
          {order.whatsapp_messages.length ? (
            <>
            <div ref={waLogRef} className="h-full overflow-y-auto p-5">
            <ul className="space-y-2.5 pr-1">
              {order.whatsapp_messages.map((message) => {
                const outbound = message.direction !== "inbound"
                const isExpanded = expandedWaIds.has(message.id)
                const waStatus = waMessageStatus(message.status)

                // 1. Pesan Otomatis (Template): tampilkan ringkas sebagai list event + status checklist (owner 2026-09-16)
                if (message.is_automated) {
                  return (
                    <li key={message.id} className="flex justify-end">
                      <div className="w-full max-w-[92%] rounded-lg border border-border bg-card p-3 shadow-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-semibold text-foreground truncate">
                              {message.label || "WA Otomatis"}
                            </span>
                            <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium">
                              Otomatis
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 text-xs">
                            {waStatus ? (
                              <span className={cn("inline-flex items-center gap-1", waStatus.className)}>
                                <Icon name={waStatus.icon as never} className="size-3.5 shrink-0" aria-hidden="true" />
                                <span>{waStatus.label}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground capitalize">{message.status}</span>
                            )}
                          </div>
                        </div>

                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span>
                            {message.date_label ? `${message.date_label}, ${message.time_label}` : formatDateTime(message.sent_at || message.received_at)}
                          </span>
                          {message.text ? (
                            <button
                              type="button"
                              onClick={() => toggleWaExpand(message.id)}
                              className="text-[11px] text-primary hover:underline font-medium"
                            >
                              {isExpanded ? "Sembunyikan isi" : "Lihat isi pesan"}
                            </button>
                          ) : null}
                        </div>

                        {isExpanded && message.text ? (
                          <p className="mt-2 border-t border-border pt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-muted-foreground">
                            {message.text}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  )
                }

                // 2. Pesan Manual / Non-Template / Balasan Pelanggan: tampilkan teks pesan lengkap
                return (
                  <li key={message.id} className={outbound ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={`max-w-[85%] rounded-lg border px-3 py-2.5 ${
                        outbound
                          ? "border-border bg-muted/40"
                          : "border-success/30 bg-success/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground">
                        <span>{outbound ? "Toko (Pesan Manual)" : "Pelanggan"}</span>
                      </div>

                      <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-5 text-foreground">
                        {message.text || message.label || humanize(message.direction)}
                      </p>

                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>
                          {message.date_label ? `${message.date_label}, ${message.time_label}` : formatDateTime(message.sent_at || message.received_at)}
                        </span>
                        {outbound && waStatus ? (
                          <span className={cn("inline-flex items-center gap-1", waStatus.className)}>
                            <Icon name={waStatus.icon as never} className="size-3.5 shrink-0" aria-hidden="true" />
                            <span>{waStatus.label}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Belum ada pesan WhatsApp.</p>
          )}
        </SectionCard>
        </div>
      </section>

      {(() => {
        const cases = order.return_cases ?? returnCases
        // Pencatatan retur kini hanya lewat popup di daftar pesanan (owner
        // 2026-09-29), jadi panel ini hanya tampil saat pesanan punya kasus
        // retur; pesanan Sampai tanpa kasus tidak menampilkan judul kosong.
        const showPanel = cases.length > 0
        // Pesanan di luar Sampai tidak menampilkan blok retur sama sekali
        // (instruksi owner 2026-09-28: pesanan Selesai tidak perlu info retur).
        if (!showPanel) return null
        return (
          <ReturnCasePanel
            order={order}
            cases={cases}
            eligibility={returnEligibility ?? { eligible: false, reason: null, deadline: null }}
            editReturnCaseId={editReturnCaseId}
            returnAdjustments={returnAdjustments}
          />
        )
      })()}



      {/* Konten utama membentang penuh tanpa aside sempit */}
      <div className="mt-4 space-y-4">
          <SectionCard
            title="Isi pesanan"
            contentClassName="p-0"
            action={
              editPolicy?.allowed ? (
                <button
                  type="button"
                  onClick={() => setEditing((value) => !value)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {editing ? "Tutup edit" : "Edit pesanan"}
                </button>
              ) : editPolicy?.reason ? (
                <span className="text-xs text-muted-foreground" title={editPolicy.reason}>
                  Terkunci
                </span>
              ) : null
            }
          >
            {/* Mode edit merender daftar produknya sendiri dengan layout baris yang
                sama, jadi daftar read-only ini disembunyikan supaya produk tidak
                tampil dua kali di kartu yang sama. */}
            {editing ? null : (
              <ul className="divide-y divide-border">
                {order.items.map((item) => (
                  <li key={item.id} className="flex gap-3.5 px-5 py-4">
                    <div className="size-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                      {item.image ? (
                        <img src={item.image} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-muted-foreground">
                          <Icon name="image" className="size-4" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-1.5">
                        <p className="text-sm font-normal leading-5 text-foreground">{item.name}</p>
                        <button
                          type="button"
                          onClick={() => copyText(item.name)}
                          className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          aria-label={`Salin ukuran & nama: ${item.name}`}
                          title="Salin ukuran & nama produk"
                        >
                          <Icon name="copy" className="size-3" aria-hidden="true" />
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {variationLabel(item) || item.variant_sku || "-"}
                      </p>
                      {item.note ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Catatan: <span className="font-medium text-foreground">{item.note}</span>
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {formatNumber(item.quantity)} × {formatCurrency(item.unit_price)}
                      </p>
                    </div>
                    <p className="tabular-nums shrink-0 text-sm font-semibold">
                      {formatCurrency(item.line_total)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {editing && editUrl ? (
              <OrderEditPanel
                order={order}
                editUrl={editUrl}
                requireNote={Boolean(editPolicy?.require_note)}
                onCancel={() => setEditing(false)}
                onCopy={copyText}
              />
            ) : null}

            {order.notes?.trim() ? (
              <div className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
                Catatan: <span className="font-medium text-foreground">{order.notes}</span>
              </div>
            ) : null}

            <dl id="biaya-ongkir" className="scroll-mt-20 space-y-2 border-t border-border bg-muted/40 px-5 py-4 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Total produk</dt>
                <dd className="font-medium">{formatNumber(order.product_count)} produk</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Total unit</dt>
                <dd className="font-medium">{formatNumber(order.unit_count)} unit</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Total harga produk</dt>
                <dd className="tabular-nums font-medium">{formatCurrency(order.subtotal_amount)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Ongkir dibayar</dt>
                <dd className="tabular-nums font-medium">{formatCurrency(order.shipping_amount)}</dd>
              </div>
              {(order.shipping_subsidy_amount ?? 0) > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Subsidi ongkir</dt>
                  <dd className="tabular-nums font-medium text-muted-foreground">
                    −{formatCurrency(order.shipping_subsidy_amount ?? 0)}
                  </dd>
                </div>
              ) : null}
              {(order.shipping_insurance_amount ?? 0) > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Asuransi pengiriman</dt>
                  <dd className="tabular-nums font-medium">
                    {formatCurrency(order.shipping_insurance_amount ?? 0)}
                  </dd>
                </div>
              ) : null}
              {order.jnt_ongkir_actual != null ? (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Tagihan J&T Cargo</dt>
                    <dd className="tabular-nums font-medium">
                      {formatCurrency(order.jnt_ongkir_actual)}
                    </dd>
                  </div>
                  {order.jnt_freight_actual != null ? (
                    <div className="flex justify-between gap-3 text-xs">
                      <dt className="pl-3 text-muted-foreground">Ongkir</dt>
                      <dd className="tabular-nums text-muted-foreground">
                        {formatCurrency(order.jnt_freight_actual)}
                      </dd>
                    </div>
                  ) : null}
                  {(order.jnt_insured_fee_actual ?? 0) > 0 ? (
                    <div className="flex justify-between gap-3 text-xs">
                      <dt className="pl-3 text-muted-foreground">Asuransi dari J&T</dt>
                      <dd className="tabular-nums text-muted-foreground">
                        {formatCurrency(order.jnt_insured_fee_actual ?? 0)}
                      </dd>
                    </div>
                  ) : null}
                  {order.jnt_chargeable_weight_kg != null ? (
                    <div className="flex justify-between gap-3 text-xs">
                      <dt className="pl-3 text-muted-foreground">Berat tagih J&T</dt>
                      <dd className="tabular-nums text-muted-foreground">
                        {order.jnt_chargeable_weight_kg} kg
                      </dd>
                    </div>
                  ) : null}
                  {(order.jnt_ongkir_selisih ?? 0) !== 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">
                        Selisih tagihan{" "}
                        <span className="text-[11px]">
                          {(order.jnt_ongkir_selisih ?? 0) > 0
                            ? "(ditanggung toko)"
                            : "(lebih hemat)"}
                        </span>
                      </dt>
                      <dd
                        className={`tabular-nums font-medium ${
                          (order.jnt_ongkir_selisih ?? 0) > 0
                            ? "text-destructive"
                            : "text-success"
                        }`}
                      >
                        {(order.jnt_ongkir_selisih ?? 0) > 0 ? "+" : "−"}
                        {formatCurrency(Math.abs(order.jnt_ongkir_selisih ?? 0))}
                      </dd>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Tagihan J&T Cargo</dt>
                  <dd className="text-xs text-muted-foreground">
                    Belum dilaporkan J&T
                  </dd>
                </div>
              )}
              {order.discount_amount > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Potongan harga (promo item)</dt>
                  <dd className="tabular-nums font-medium text-muted-foreground">
                    −{formatCurrency(order.discount_amount)}
                  </dd>
                </div>
              ) : null}
              {(order.voucher_discount_amount ?? 0) > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">
                    Voucher{order.voucher_code ? ` (${order.voucher_code})` : ""}
                  </dt>
                  <dd className="tabular-nums font-medium text-destructive">
                    −{formatCurrency(order.voucher_discount_amount ?? 0)}
                  </dd>
                </div>
              ) : null}
              {(order.cod_fee_amount ?? 0) > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Biaya COD</dt>
                  <dd className="tabular-nums font-medium">
                    {formatCurrency(order.cod_fee_amount ?? 0)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3 border-t border-border pt-2.5 text-sm">
                <dt className="font-semibold">{isCod ? "Total tagihan (COD)" : "Total tagihan"}</dt>
                <dd className="tabular-nums font-semibold">{formatCurrency(order.total_amount)}</dd>
              </div>
            </dl>
          </SectionCard>

      </div>
      {printing ? (
        <PrintOrderArea
          data={{
            ...order,
            items: order.items.map((item) => ({
              id: item.id,
              name: item.name,
              variant_sku: item.variant_sku,
              variation_1_name: item.variation_1_name,
              variation_1_option: item.variation_1_option,
              variation_2_name: item.variation_2_name,
              variation_2_option: item.variation_2_option,
              quantity: item.quantity,
              unit_price: item.unit_price,
              line_total: item.line_total,
              note: item.note,
            })),
          }}
        />
      ) : null}
      {/* Dialog Modal Catatan Internal Admin */}
      <DialogPrimitive.Root open={notesModalOpen} onOpenChange={setNotesModalOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-[80] flex max-h-[min(90dvh,34rem)] w-[min(calc(100%-2rem),30rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl duration-200",
              "data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95",
            )}
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className="sr-only">Catatan internal admin</DialogPrimitive.Title>

            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Catatan Internal Admin</h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  Pesanan {order.order_number} · {order.customer_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotesModalOpen(false)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Tutup popup catatan"
              >
                <Icon name="x" className="size-4" aria-hidden="true" />
              </button>
            </div>

            {notesMode === "view" ? (
              <div className="p-5 space-y-4">
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 overflow-hidden">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    <Icon name="clipboard-text" className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <span>Isi Catatan Lengkap:</span>
                  </div>
                  <p className="mt-2.5 whitespace-pre-wrap break-all break-words text-xs leading-relaxed text-foreground">
                    {order.admin_notes}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
                  <ConfirmAction
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 text-xs"
                        disabled={notesBusy}
                      >
                        Hapus Catatan
                      </Button>
                    }
                    title="Hapus catatan internal?"
                    description="Isi catatan internal pesanan ini akan dihapus permanen dan tidak bisa dikembalikan."
                    confirmLabel="Hapus Catatan"
                    processing={notesBusy}
                    onConfirm={deleteAdminNotes}
                  />

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setNotesModalOpen(false)}
                    >
                      Tutup
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setNotesText(order.admin_notes ?? "")
                        setNotesMode("edit")
                      }}
                    >
                      Edit Catatan
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  saveAdminNotes(notesText)
                }}
                className="p-5 space-y-4"
              >
                <div className="space-y-1.5">
                  <label htmlFor="show-notes-textarea" className="text-xs font-semibold text-foreground">
                    Catatan Internal (Khusus Tim Admin & Gudang)
                  </label>
                  <Textarea
                    id="show-notes-textarea"
                    rows={4}
                    value={notesText}
                    onChange={(event) => setNotesText(event.target.value)}
                    placeholder="Tulis instruksi khusus, riwayat kendala pelanggan, atau catatan pengerjaan..."
                    maxLength={5000}
                    className="resize-y"
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Maksimal 5.000 karakter. Catatan ini bersifat privat dan tidak dapat dibaca oleh pembeli.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={notesBusy}
                    onClick={() => {
                      if (order.admin_notes?.trim()) {
                        setNotesMode("view")
                      } else {
                        setNotesModalOpen(false)
                      }
                    }}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={notesBusy || (!notesText.trim() && !order.admin_notes)}
                  >
                    {notesBusy ? "Menyimpan..." : "Simpan Catatan"}
                  </Button>
                </div>
              </form>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Sheet Samping Khusus: Status Pengiriman & Lacak Pesanan J&T */}
      <Sheet open={trackingOpen} onOpenChange={setTrackingOpen}>
        <SheetContent
          side="right"
          title="Status Pengiriman & Lacak Pesanan"
          className="w-[min(90vw,28rem)] sm:max-w-md p-0"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Status Pengiriman & Lacak Pesanan</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pesanan {order.order_number} · {order.customer_name}
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <ShippingTrackPanel
              track={
                tracking ?? {
                  shipping_status: order.shipping_status,
                  carrier_name: latestShipping?.carrier_name,
                  waybill_number: latestShipping?.waybill_number,
                  record_status: latestShipping?.status,
                  status_raw: latestShipping?.status_raw,
                  last_status_at: latestShipping?.last_status_at,
                  tracking_url: latestShipping?.tracking_url,
                  order_status: order.order_status,
                  payment_status: order.payment_status,
                  payment_method: order.payment_method,
                  total_amount: order.total_amount,
                }
              }
              timeline={tracking?.timeline}
              jntEnabled={shippingActions.jntEnabled}
              refreshBusy={refreshBusy}
              onRefresh={latestShipping?.waybill_number ? refreshShipping : undefined}
              onCopyWaybill={copyText}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Drawer Detail kartu log: riwayat pesanan, log perubahan status, dan
          log WhatsApp. Kartu di halaman ber-tinggi tetap dengan isi ringkas;
          isi lengkapnya dibuka lewat tombol Detail di header kartu. */}
      <Sheet
        open={detailDrawer !== null}
        onOpenChange={(open) => {
          if (!open) setDetailDrawer(null)
        }}
      >
        <SheetContent
          side="right"
          title={
            detailDrawer === "riwayat"
              ? "Riwayat Pesanan"
              : detailDrawer === "status"
                ? "Log Perubahan Status"
                : "Log WhatsApp"
          }
          className="w-[min(90vw,28rem)] sm:max-w-md p-0"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {detailDrawer === "riwayat"
                  ? "Riwayat Pesanan"
                  : detailDrawer === "status"
                    ? "Log Perubahan Status"
                    : "Log WhatsApp"}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pesanan {order.order_number} · {order.customer_name}
              </p>
            </div>
          </div>

          <div className="p-5">
            {detailDrawer === "riwayat" ? (
              <div className="space-y-5 text-[13px]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Data Pesanan
                  </p>
                  <ol className="mt-2.5 space-y-2.5">
                    <li className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Nomor pesanan</span>
                      <span className="font-medium">{order.order_number}</span>
                    </li>
                    <li className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Waktu pemesanan</span>
                      <span className="font-medium">{formatDateTime(order.created_at)}</span>
                    </li>
                    <li className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Update terakhir</span>
                      <span className="font-medium">{formatDateTime(order.updated_at)}</span>
                    </li>
                    {lastEventAt ? (
                      <li className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Event terakhir</span>
                        <span className="font-medium">{formatDateTime(lastEventAt)}</span>
                      </li>
                    ) : null}
                    {liveState !== "unavailable" && liveState !== "connected" ? (
                      <li className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Pembaruan langsung</span>
                        <span className="font-medium text-warning">{liveConnectionLabel(liveState)}</span>
                      </li>
                    ) : null}
                  </ol>
                </div>

                {order.payments?.length ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pembayaran
                    </p>
                    <ol className="mt-2.5 space-y-2.5">
                      {order.payments.map((payment) => (
                        <li key={payment.id} className="border-b border-border pb-2.5 last:border-0 last:pb-0">
                          <p className="font-medium">
                            {payment.payment_method} · {formatCurrency(payment.amount)}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Status: {payment.status}
                            {payment.paid_at ? ` · Dibayar ${formatDateTime(payment.paid_at)}` : ""}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                {order.shipping_records.length ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pengiriman
                    </p>
                    <ol className="mt-2.5 space-y-2.5">
                      {order.shipping_records.map((record) => (
                        <li key={record.id} className="border-b border-border pb-2.5 last:border-0 last:pb-0">
                          <p className="font-medium">
                            {record.carrier_name || "Kurir"}
                            {record.waybill_number ? ` · ${record.waybill_number}` : ""}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Status: {record.status || "-"}
                            {record.last_status_at ? ` · ${formatDateTime(record.last_status_at)}` : ""}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
            ) : detailDrawer === "status" ? (
              events.length ? (
                <ol className="space-y-2.5 text-[13px]">
                  {events.map((event, index) => (
                    <li
                      key={`${event.event_type}-${index}`}
                      className="border-b border-border pb-2.5 last:border-0 last:pb-0"
                    >
                      <p className="font-medium">{event.label || humanize(event.event_type)}</p>
                      {typeof event.payload?.reason === "string" && event.payload.reason ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">Alasan: {event.payload.reason}</p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(event.created_at)}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-muted-foreground">Belum ada log status.</p>
              )
            ) : order.whatsapp_messages.length ? (
              <ol className="space-y-2.5">
                {order.whatsapp_messages.map((message) => {
                  const outbound = message.direction !== "inbound"
                  const waStatus = waMessageStatus(message.status)
                  return (
                    <li key={message.id} className={outbound ? "flex justify-end" : "flex justify-start"}>
                      <div
                        className={`w-full max-w-[95%] rounded-lg border px-3 py-2.5 ${
                          outbound
                            ? message.is_automated
                              ? "border-border bg-card shadow-xs"
                              : "border-border bg-muted/40"
                            : "border-success/30 bg-success/5"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-xs font-semibold text-foreground">
                              {message.label || (outbound ? "Toko (Pesan Manual)" : "Pelanggan")}
                            </span>
                            {message.is_automated ? (
                              <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                Otomatis
                              </span>
                            ) : null}
                          </div>
                          {waStatus ? (
                            <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs", waStatus.className)}>
                              <Icon name={waStatus.icon as never} className="size-3.5 shrink-0" aria-hidden="true" />
                              <span>{waStatus.label}</span>
                            </span>
                          ) : null}
                        </div>
                        {!message.is_automated && message.text ? (
                          <p className="mt-1.5 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-muted-foreground">
                            {message.text}
                          </p>
                        ) : null}
                        <div className="mt-1.5 text-[11px] text-muted-foreground">
                          {message.date_label
                            ? `${message.date_label}, ${message.time_label}`
                            : formatDateTime(message.sent_at || message.received_at)}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p className="text-xs text-muted-foreground">Belum ada pesan WhatsApp.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Popup balas ulasan pelanggan. Komponennya sama dengan yang dipakai
          daftar ulasan, jadi balasan bisa ditulis dari dua tempat. */}
      <ReviewReplyDialog
        row={reviewReplyOpen && order.testimonial ? order.testimonial : null}
        onClose={() => setReviewReplyOpen(false)}
      />
    </AdminLayout>
  )
}

