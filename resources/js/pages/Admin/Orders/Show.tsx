import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { Checkbox } from "@/components/admin/ui/checkbox"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
import {
  PrintAddressArea,
  usePrintAddress,
} from "@/components/shared/print-address"
import { ShippingTrackPanel } from "@/components/shared/shipping-track-panel"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency, formatNumber, humanize } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { statusMeta } from "@/lib/status"

interface OrderItemRow {
  id: number
  name: string
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
  shipping_subsidy_amount?: number
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
  items: OrderItemRow[]
  payments: Array<{
    id: number
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
  whatsapp_messages: Array<{
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

const orderStatuses = [
  "pending_payment",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "issue",
  "return_in_process",
  "cancelled",
]

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
}: {
  order: OrderDetail
  editUrl: string
  requireNote: boolean
  onCancel: () => void
}) {
  const [newLine, setNewLine] = React.useState({ parent_sku: "", variant_sku: "", qty: 1 })
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

  function addLine() {
    const sku = newLine.parent_sku.trim()
    if (!sku) return
    form.setData("items", [
      ...form.data.items,
      {
        item_id: null,
        parent_sku: sku,
        variant_sku: newLine.variant_sku.trim(),
        qty: Math.max(1, newLine.qty),
      },
    ])
    setNewLine({ parent_sku: "", variant_sku: "", qty: 1 })
  }

  function submit() {
    const lines = form.data.items.filter((line) => line.qty >= 1)
    if (lines.length === 0) return
    form.setData("items", lines)
    form.put(editUrl, { preserveScroll: true })
  }

  return (
    <div className="space-y-4 border-t border-border bg-muted/30 px-5 py-4">
      <FormErrorSummary errors={form.errors} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Produk
        </p>
        <ul className="mt-2 space-y-2">
          {form.data.items.map((line, index) => {
            const original = line.item_id != null ? itemById.get(line.item_id) : undefined
            return (
              <li key={line.item_id ?? `new-${index}`} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {original?.name ?? (line.parent_sku || "(produk baru)")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {original
                      ? variationLabel(original) || original.variant_sku || "-"
                      : line.variant_sku || "tanpa varian"}
                  </p>
                </div>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  value={String(line.qty)}
                  onChange={(event) => setQty(index, Number(event.target.value) || 1)}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(index)}>
                  Hapus
                </Button>
              </li>
            )
          })}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            className="w-36"
            placeholder="parent_sku"
            value={newLine.parent_sku}
            onChange={(event) => setNewLine({ ...newLine, parent_sku: event.target.value })}
          />
          <Input
            className="w-40"
            placeholder="variant_sku (opsional)"
            value={newLine.variant_sku}
            onChange={(event) => setNewLine({ ...newLine, variant_sku: event.target.value })}
          />
          <Input
            type="number"
            min={1}
            className="w-20"
            value={String(newLine.qty)}
            onChange={(event) => setNewLine({ ...newLine, qty: Number(event.target.value) || 1 })}
          />
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            Tambah produk
          </Button>
        </div>
      </div>

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
          {form.processing ? "Menyimpan..." : "Simpan perubahan"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </div>
  )
}


interface ReturnCaseItem {
  id: number
  order_item_id: number
  name?: string | null
  requested_quantity: number
  returned_quantity: number
}

interface ReturnCase {
  id: number
  status: string
  reason: string
  resolution_type?: string | null
  customer_notes?: string | null
  admin_notes?: string | null
  refund_amount: number
  replacement_amount: number
  additional_shipping_amount: number
  completed_at?: string | null
  items: ReturnCaseItem[]
}

function ReturnCasePanel({
  order,
  cases,
  returnUrl,
}: {
  order: OrderDetail
  cases: ReturnCase[]
  returnUrl: string
}) {
  const form = useForm({
    reason: "rusak",
    customer_notes: "",
    admin_notes: "",
    resolution_type: "",
    refund_amount: "0",
    replacement_amount: "0",
    additional_shipping_amount: "0",
    items: order.items.map((item) => ({ order_item_id: item.id, requested_quantity: item.quantity })),
  })
  const [completion, setCompletion] = React.useState<Record<number, { resolution_type: string; admin_notes: string }>>({})

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.post(returnUrl, { preserveScroll: true })
  }

  return (
    <div id="return-case"><SectionCard title="Retur & penyelesaian">
      <div className="space-y-4">
        {cases.map((item) => (
          <div key={item.id} className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">Kasus #{item.id} · {item.reason}</span>
              <StatusBadge status={item.status} />
            </div>
            {item.customer_notes ? <p className="mt-2 text-xs text-muted-foreground">{item.customer_notes}</p> : null}
            {item.admin_notes ? <p className="mt-1 text-xs text-muted-foreground">Catatan admin: {item.admin_notes}</p> : null}
            {item.status === "open" ? (
              <form
                className="mt-3 space-y-3 border-t border-border pt-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  const data = completion[item.id] ?? { resolution_type: "no_compensation", admin_notes: "" }
                  router.post(routeUrl("admin.orders.returns.complete", { order: order.id, returnCase: item.id }), data, { preserveScroll: true })
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id={`return-resolution-${item.id}`} label="Resolusi" required>
                    <Select
                      value={(completion[item.id] ?? { resolution_type: "no_compensation" }).resolution_type}
                      onChange={(event) => setCompletion((current) => ({ ...current, [item.id]: { ...(current[item.id] ?? { admin_notes: "" }), resolution_type: event.target.value } }))}
                    >
                      <option value="no_compensation">Tidak ada kompensasi</option>
                      <option value="refund">Refund</option>
                      <option value="replacement">Penggantian barang</option>
                      <option value="reship">Kirim ulang</option>
                      <option value="compensation">Kompensasi</option>
                    </Select>
                  </Field>
                  <Field id={`return-completion-note-${item.id}`} label="Catatan penyelesaian" required>
                    <Textarea
                      rows={2}
                      value={(completion[item.id] ?? { admin_notes: "" }).admin_notes}
                      onChange={(event) => setCompletion((current) => ({ ...current, [item.id]: { ...(current[item.id] ?? { resolution_type: "no_compensation" }), admin_notes: event.target.value } }))}
                    />
                  </Field>
                </div>
                <Button type="submit" size="sm">Tandai retur selesai</Button>
              </form>
            ) : null}
          </div>
        ))}
        {order.order_status === "delivered" || order.order_status === "completed" ? (
          <form className="space-y-3 border-t border-border pt-4" onSubmit={submit}>
            <p className="text-xs text-muted-foreground">Isi admin. Customer mengirim kronologi/foto melalui WhatsApp; tidak ada form retur publik.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="return-reason" label="Alasan retur" required error={form.errors.reason}>
                <Select value={form.data.reason} onChange={(event) => form.setData("reason", event.target.value)}>
                  <option value="rusak">Rusak/pecah</option>
                  <option value="salah_ukuran">Salah ukuran</option>
                  <option value="salah_produk">Salah produk</option>
                  <option value="kurang">Barang kurang</option>
                  <option value="lainnya">Lainnya</option>
                </Select>
              </Field>
              <Field id="return-customer-notes" label="Kronologi pelanggan" required error={form.errors.customer_notes}>
                <Textarea rows={2} value={form.data.customer_notes} onChange={(event) => form.setData("customer_notes", event.target.value)} />
              </Field>
            </div>
            <Field id="return-admin-notes" label="Catatan admin (opsional)" error={form.errors.admin_notes}>
              <Textarea rows={2} value={form.data.admin_notes} onChange={(event) => form.setData("admin_notes", event.target.value)} placeholder="Bukti unboxing/foto dikirim via WhatsApp, hasil inspeksi, dll." />
            </Field>
            <div className="space-y-2">
              <p className="text-xs font-semibold">Item yang diretur</p>
              {form.data.items.map((row, index) => (
                <div key={row.order_item_id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 flex-1 truncate">{order.items[index]?.name ?? `Item #${row.order_item_id}`}</span>
                  <Input className="w-24" type="number" min="1" max={order.items[index]?.quantity ?? 1} value={String(row.requested_quantity)} onChange={(event) => form.setData("items", form.data.items.map((line, i) => i === index ? { ...line, requested_quantity: Number(event.target.value) || 1 } : line))} />
                </div>
              ))}
            </div>
            <Button type="submit" disabled={form.processing}>{form.processing ? "Menyimpan..." : "Catat retur"}</Button>
          </form>
        ) : null}
      </div>
    </SectionCard></div>
  )
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
  workflowLinks,
  editPolicy,
  editUrl,
  returnCases = [],
  returnUrl,
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
  returnUrl: string
}) {
  const isCod = order.flow === "cod" || order.cod_flag
  const lacakRef = React.useRef<HTMLElement | null>(null)
  const statusForm = useForm({ order_status: order.order_status })
  const [statusBusy, setStatusBusy] = React.useState(false)
  const paymentForm = useForm({
    payment_method: isCod ? "cod" : "transfer",
    amount: String(Math.round(order.total_amount)),
    status: isCod ? "pending" : "completed",
    transaction_reference: "",
    evidence_url: "",
    paid_at: "",
  })
  const shippingForm = useForm({
    waybill_number: "",
    mark_shipped: true,
  })
  const [refreshBusy, setRefreshBusy] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [showAllEvents, setShowAllEvents] = React.useState(false)
  const [showAllWa, setShowAllWa] = React.useState(false)
  const { printing, handlePrint } = usePrintAddress()
  const [adminNotes, setAdminNotes] = React.useState(order.admin_notes ?? "")
  const [adminNotesBusy, setAdminNotesBusy] = React.useState(false)

  function saveAdminNotes(next: string) {
    if (!adminNotesUrl) return
    setAdminNotesBusy(true)
    router.put(
      adminNotesUrl,
      { admin_notes: next },
      {
        preserveScroll: true,
        onFinish: () => setAdminNotesBusy(false),
      },
    )
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
      lacakRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }
    if (!primaryAction?.next_status) return
    updateStatus(primaryAction.next_status)
  }

  function storePayment(event: React.FormEvent) {
    event.preventDefault()
    paymentForm.post(routeUrl("admin.payments.store", { order: order.id }), {
      preserveScroll: true,
      onSuccess: () => paymentForm.reset("transaction_reference", "evidence_url", "paid_at"),
    })
  }

  function storeShipping(event: React.FormEvent) {
    event.preventDefault()
    shippingForm.post(shippingActions.createUrl, { preserveScroll: true })
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
  const needsResi = !latestShipping?.waybill_number


  return (
    <AdminLayout
      title={`Pesanan ${order.order_number}`}
      description={order.customer_name}
      actions={
        <Button asChild variant="secondary">
          <Link href={routeUrl("admin.orders.index")}>
            <Icon name="arrow-left" className="size-4" aria-hidden="true" />
            Kembali
          </Link>
        </Button>
      }
    >
      <Head title={`Pesanan ${order.order_number} | Admin`} />

      {/* Ringkasan order — 4 sel dengan hairline divider */}
      <Card className="grid gap-px overflow-hidden bg-border sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Nomor order</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <p className="font-mono text-base font-semibold tracking-tight">{order.order_number}</p>
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
        <div className="bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Pembayaran</p>
          <p className="mt-1.5 text-sm font-semibold">{order.payment_method_label}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={order.payment_status} />
            <span className="inline-flex min-h-6 items-center rounded-full border border-border px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {isCod ? "COD" : "Transfer"}
            </span>
          </div>
        </div>
        <div className="bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Penerima</p>
          <p className="mt-1.5 text-sm font-semibold">{order.customer_name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{order.customer_phone || "-"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[order.shipping_city, order.shipping_province].filter(Boolean).join(", ") || "-"}
          </p>
        </div>
        <div className="bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Ringkasan</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {formatNumber(order.product_count)} produk · {formatNumber(order.unit_count)} unit
          </p>
          <p className="tabular-nums mt-1 text-xl font-semibold tracking-tight">
            {formatCurrency(order.total_amount)}
          </p>
        </div>
      </Card>


      {/* Aksi utama */}
      <Card className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        {primaryAction?.next_status ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button disabled={statusBusy} onClick={runPrimary} className="shrink-0">
              {statusBusy ? "Memproses..." : primaryAction.label}
            </Button>
            {primaryAction.hint ? (
              <p className="truncate text-xs text-muted-foreground">{primaryAction.hint}</p>
            ) : null}
          </div>
        ) : null}
        {secondaryAction?.href ? (
          <Button asChild variant="secondary" className="shrink-0"><a href={secondaryAction.href}>{secondaryAction.label}</a></Button>
        ) : null}
        {secondaryAction?.next_status ? (
          <Button
            variant="secondary"
            disabled={statusBusy}
            onClick={() => updateStatus(secondaryAction.next_status!)}
            className="shrink-0"
          >
            {statusBusy ? "Memproses..." : secondaryAction.label}
          </Button>
        ) : null}
        {order.whatsapp_url ? (
          <Button asChild variant="ghost">
            <a href={order.whatsapp_url} target="_blank" rel="noreferrer">
              <Icon name="whatsapp" className="size-4" aria-hidden="true" />
              Chat WA
            </a>
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={() => copyText(fullAddress(order))}>
          <Icon name="copy" className="size-3.5" aria-hidden="true" />
          Salin alamat
        </Button>
        {workflowLinks.map((link) => (
          <Button key={link.href} asChild variant="ghost">
            <Link href={link.href}>{link.label}</Link>
          </Button>
        ))}
        {order.order_status !== "cancelled" ? (
          <ConfirmAction
            trigger={
              <Button variant="ghost" className="text-destructive hover:text-destructive">
                Batalkan pesanan
              </Button>
            }
            title="Batalkan pesanan?"
            description="Status akan berubah menjadi dibatalkan dan tercatat di log."
            confirmLabel="Batalkan"
            processing={statusBusy}
            reasonLabel="Alasan (opsional)"
            reasonPlaceholder="Misalnya: pelanggan meminta pembatalan"
            onConfirm={(reason) => updateStatus("cancelled", reason)}
          />
        ) : null}
      </Card>

      {/* Riwayat — 3 kolom */}
      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Riwayat pesanan">
          <ol className="space-y-2.5 text-[13px]">
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">Waktu pemesanan</span>
              <span className="font-medium">{formatDateTime(order.created_at)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">Update terakhir</span>
              <span className="font-medium">{formatDateTime(order.updated_at)}</span>
            </li>
          </ol>
        </SectionCard>
        <SectionCard title="Log perubahan status">
          {events.length ? (
            <>
            <ul className="space-y-2.5 text-[13px]">
              {(showAllEvents ? events : events.slice(0, 4)).map((event, index) => (
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
            {events.length > 4 ? (
              <button
                type="button"
                onClick={() => setShowAllEvents((v) => !v)}
                className="mt-3 text-xs font-medium text-primary hover:underline"
              >
                {showAllEvents ? "Sembunyikan riwayat" : "Tampilkan riwayat lengkap"}
              </button>
            ) : null}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Belum ada log status.</p>
          )}
        </SectionCard>
        <SectionCard title="Riwayat WA otomatis">
          {order.whatsapp_messages.length ? (
            <>
            <ul className="space-y-2.5 text-[13px]">
              {(showAllWa ? order.whatsapp_messages : order.whatsapp_messages.slice(0, 4)).map((message) => (
                <li
                  key={message.id}
                  className="border-b border-border pb-2.5 last:border-0 last:pb-0"
                >
                  <p className="font-medium">
                    {message.label ||
                      (message.internal_template_key
                        ? humanize(message.internal_template_key)
                        : humanize(message.direction))}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge status={message.status} />
                    {formatDateTime(message.sent_at || message.received_at)}
                  </p>
                </li>
              ))}
            
            </ul>
            {order.whatsapp_messages.length > 4 ? (
              <button
                type="button"
                onClick={() => setShowAllWa((v) => !v)}
                className="mt-3 text-xs font-medium text-primary hover:underline"
              >
                {showAllWa ? "Sembunyikan riwayat" : "Tampilkan riwayat lengkap"}
              </button>
            ) : null}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Belum ada pesan WhatsApp.</p>
          )}
        </SectionCard>
      </section>

      {order.flow_hint ? (
        <p className="mt-4 rounded-lg border border-border bg-card px-4 py-3 text-xs leading-5 text-muted-foreground">
          {order.flow_hint}
        </p>

      ) : null}

      <ReturnCasePanel order={order} cases={returnCases} returnUrl={returnUrl} />

      {/* Konten utama + aside */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
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
                      <p className="text-sm font-medium leading-5">{item.name}</p>
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
                      <p className="mt-1.5 rounded-md bg-accent/60 px-2 py-1 text-xs leading-5 text-accent-foreground">
                        <span className="font-semibold">Catatan pembeli:</span> {item.note}
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
            {editing && editUrl ? (
              <OrderEditPanel
                order={order}
                editUrl={editUrl}
                requireNote={Boolean(editPolicy?.require_note)}
                onCancel={() => setEditing(false)}
              />
            ) : null}
            <dl className="space-y-2 border-t border-border bg-muted/40 px-5 py-4 text-[13px]">
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
                <dt className="font-semibold">{isCod ? "Total tagihan COD" : "Total tagihan"}</dt>
                <dd className="tabular-nums font-semibold">{formatCurrency(order.total_amount)}</dd>
              </div>
            </dl>
          </SectionCard>


          <SectionCard
            title="Alamat pengiriman"
            action={
              <div className="flex items-center gap-3">
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
            }
          >
            <p className="text-sm font-semibold">{order.customer_name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{order.customer_phone}</p>
            <p className="mt-3 text-[13px] leading-6 text-foreground">
              {fullAddress(order) || "-"}
            </p>
          </SectionCard>

          <SectionCard title="Pembayaran tercatat" contentClassName="p-0">
            {order.payments.length ? (
              <ul className="divide-y divide-border">
                {order.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{humanize(payment.payment_method)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {payment.transaction_reference || formatDateTime(payment.paid_at)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusBadge status={payment.status} />
                      <p className="tabular-nums mt-1 text-[13px] font-semibold">
                        {formatCurrency(payment.amount)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-5 text-xs text-muted-foreground">Belum ada pembayaran.</p>
            )}
          </SectionCard>
        </div>


        <aside className="space-y-4">
          <SectionCard title="Catatan pembeli">
            <p className="whitespace-pre-wrap text-[13px] leading-6 text-muted-foreground">
              {order.notes?.trim() || "Tidak ada catatan dari pembeli."}
            </p>
          </SectionCard>

          <SectionCard
            title="Catatan internal"
            description="Hanya terlihat admin — tidak masuk invoice atau WhatsApp."
          >
            <div className="space-y-2.5">
              <Textarea
                rows={4}
                value={adminNotes}
                onChange={(event) => setAdminNotes(event.target.value)}
                placeholder="Tulis catatan internal untuk pesanan ini…"
                maxLength={5000}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={adminNotesBusy}
                  onClick={() => saveAdminNotes(adminNotes)}
                >
                  {adminNotesBusy ? "Menyimpan..." : "Simpan catatan"}
                </Button>
                {order.admin_notes?.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={adminNotesBusy}
                    onClick={() => {
                      setAdminNotes("")
                      saveAdminNotes("")
                    }}
                  >
                    Hapus
                  </Button>
                ) : null}
              </div>
            </div>
          </SectionCard>

          <section ref={lacakRef} id="lacak-pesanan" className="space-y-4">
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
              jntEnabled={shippingActions.jntEnabled}
              refreshBusy={refreshBusy}
              onRefresh={latestShipping?.waybill_number ? refreshShipping : undefined}
              onCopyWaybill={copyText}
            />

            {isCod && order.order_status === "delivered" ? (
              <p className="rounded-lg border border-warning/25 bg-warning/10 px-4 py-3 text-xs font-medium leading-5 text-warning-foreground">
                Paket diterima — pastikan pembayaran COD sudah dikonfirmasi.
              </p>
            ) : null}

            {needsResi || order.order_status === "processing" ? (
              <SectionCard title="Input resi">
                <form onSubmit={storeShipping} className="space-y-3.5">
                  <FormErrorSummary errors={shippingForm.errors} />
                  <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
                    Resi dibuat di J&T di luar website. Simpan nomor resi yang sudah diterbitkan kurir di sini.
                  </p>
                  <Field
                    id="waybill"
                    label="Nomor resi"
                    required
                    error={shippingForm.errors.waybill_number}
                  >
                    <Input
                      value={shippingForm.data.waybill_number}
                      onChange={(event) =>
                        shippingForm.setData("waybill_number", event.target.value)
                      }
                      placeholder="Mis. JT1234567890"
                    />
                  </Field>
                  <Checkbox
                    compact
                    checked={Boolean(shippingForm.data.mark_shipped)}
                    onChange={(event) =>
                      shippingForm.setData("mark_shipped", event.target.checked)
                    }
                    label="Tandai pesanan sebagai dikirim setelah resi tersimpan"
                  />
                  <Button type="submit" className="w-full" disabled={shippingForm.processing}>
                    {shippingForm.processing ? "Menyimpan..." : "Simpan resi"}
                  </Button>
                </form>
              </SectionCard>
            ) : null}
          </section>


          <SectionCard title="Ubah status">
            <Select
              value={statusForm.data.order_status}
              onChange={(event) => statusForm.setData("order_status", event.target.value)}
              aria-label="Status pesanan"
            >
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusMeta(status).label}
                </option>
              ))}
            </Select>
            {statusForm.errors.order_status ? (
              <p className="mt-2 text-xs font-medium text-destructive">
                {statusForm.errors.order_status}
              </p>
            ) : null}
            <Button
              className="mt-3 w-full"
              disabled={statusBusy || statusForm.data.order_status === order.order_status}
              onClick={() => updateStatus()}
            >
              {statusBusy ? "Menyimpan..." : "Simpan status"}
            </Button>
          </SectionCard>

          <SectionCard
            title={isCod ? "Pembayaran COD" : "Konfirmasi transfer"}
            description={
              isCod
                ? "Tagihan COD biasanya dikonfirmasi saat paket sampai."
                : "Isi referensi bukti transfer, status selesai, lalu simpan."
            }
          >
            <form onSubmit={storePayment} className="space-y-3.5">
              <FormErrorSummary errors={paymentForm.errors} />
              <Field id="payment-method" label="Metode" required error={paymentForm.errors.payment_method}>
                <Select
                  value={paymentForm.data.payment_method}
                  onChange={(event) => paymentForm.setData("payment_method", event.target.value)}
                >
                  <option value="cod">COD</option>
                  <option value="transfer">Transfer</option>
                  <option value="gateway">Gateway</option>
                </Select>
              </Field>
              <Field id="payment-amount" label="Jumlah" required error={paymentForm.errors.amount}>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={paymentForm.data.amount}
                  onChange={(event) => paymentForm.setData("amount", event.target.value)}
                />
              </Field>
              <Field id="payment-status" label="Status" required error={paymentForm.errors.status}>
                <Select
                  value={paymentForm.data.status}
                  onChange={(event) => paymentForm.setData("status", event.target.value)}
                >
                  {["pending", "completed", "failed", "refunded"].map((status) => (
                    <option key={status} value={status}>
                      {statusMeta(status).label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                id="payment-reference"
                label={isCod ? "Catatan COD (opsional)" : "No. referensi / bukti transfer"}
                error={paymentForm.errors.transaction_reference}
              >
                <Input
                  value={paymentForm.data.transaction_reference}
                  onChange={(event) =>
                    paymentForm.setData("transaction_reference", event.target.value)
                  }
                  placeholder={isCod ? "Mis. kurir konfirmasi lunas" : "Mis. TRX123 / jam transfer"}
                />
              </Field>
              <Button type="submit" className="w-full" disabled={paymentForm.processing}>
                {paymentForm.processing
                  ? "Menyimpan..."
                  : isCod
                    ? "Catat pembayaran COD"
                    : "Konfirmasi transfer"}
              </Button>
            </form>
          </SectionCard>
        </aside>
      </div>
      {printing ? (
        <PrintAddressArea
          data={{
            ...order,
            items: order.items.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              note: item.note,
              variation_label: variationLabel(item),
            })),
          }}
        />
      ) : null}
    </AdminLayout>
  )
}

