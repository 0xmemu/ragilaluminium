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
import { Icon } from "@/components/shared/icon"
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

export default function OrderShow({
  order,
  events = [],
  tracking,
  primaryAction,
  updateStatusUrl,
  shippingActions,
  workflowLinks,
}: {
  order: OrderDetail
  events?: OrderEvent[]
  tracking?: TrackingProps
  primaryAction: PrimaryAction | null
  updateStatusUrl: string
  shippingActions: ShippingActions
  workflowLinks: Array<{ label: string; href: string }>
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
    mode: shippingActions.jntEnabled ? "jnt" : "manual",
    waybill_number: "",
    weight_kg: "1",
    mark_shipped: true,
  })
  const [refreshBusy, setRefreshBusy] = React.useState(false)

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
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Nomor order
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="font-mono text-base font-semibold tracking-tight">{order.order_number}</p>
            <button
              type="button"
              onClick={() => copyText(order.order_number)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Icon name="copy" className="size-3" aria-hidden="true" />
              Salin
            </button>
          </div>
          <div className="mt-2.5">
            <StatusBadge status={order.order_status} />
          </div>
        </div>
        <div className="bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Pembayaran
          </p>
          <p className="mt-2 text-sm font-semibold">{order.payment_method_label}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={order.payment_status} />
            <span className="inline-flex min-h-6 items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {isCod ? "Alur COD" : "Alur transfer"}
            </span>
          </div>
        </div>
        <div className="bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Penerima
          </p>
          <p className="mt-2 text-sm font-semibold">{order.customer_name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{order.customer_phone || "-"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[order.shipping_city, order.shipping_province].filter(Boolean).join(", ") || "-"}
          </p>
        </div>
        <div className="bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Ringkasan
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatNumber(order.product_count)} produk · {formatNumber(order.unit_count)} unit
          </p>
          <p className="tabular-nums mt-1 text-xl font-semibold tracking-tight">
            {formatCurrency(order.total_amount)}
          </p>
        </div>
      </Card>


      {/* Aksi utama */}
      <Card className="mt-4 flex flex-wrap items-center gap-2 p-3">
        {primaryAction?.next_status ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs">
            <Button disabled={statusBusy} onClick={runPrimary}>
              {statusBusy ? "Memproses..." : primaryAction.label}
            </Button>
            {primaryAction.hint ? (
              <p className="text-xs text-muted-foreground">{primaryAction.hint}</p>
            ) : null}
          </div>
        ) : null}
        {order.whatsapp_url ? (
          <Button asChild variant="secondary">
            <a href={order.whatsapp_url} target="_blank" rel="noreferrer">
              <Icon name="whatsapp" className="size-4" aria-hidden="true" />
              Chat WA
            </a>
          </Button>
        ) : null}
        <Button type="button" variant="secondary" onClick={() => copyText(fullAddress(order))}>
          <Icon name="copy" className="size-3.5" aria-hidden="true" />
          Salin alamat
        </Button>
        {workflowLinks.map((link) => (
          <Button key={link.href} asChild variant="secondary">
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
            <ul className="space-y-2.5 text-[13px]">
              {events.slice(0, 4).map((event, index) => (
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
        <SectionCard title="Riwayat WA otomatis">
          {order.whatsapp_messages.length ? (
            <ul className="space-y-2.5 text-[13px]">
              {order.whatsapp_messages.slice(0, 4).map((message) => (
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


      {/* Konten utama + aside */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <SectionCard title="Isi pesanan" contentClassName="p-0">
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
                    <p className="text-sm font-medium leading-5">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {variationLabel(item) || item.variant_sku || "-"}
                    </p>
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
              <button
                type="button"
                onClick={() => copyText(fullAddress(order))}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Icon name="copy" className="size-3" aria-hidden="true" />
                Salin
              </button>
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


        <aside className="space-y-5">
          <SectionCard title="Catatan internal">
            <p className="whitespace-pre-wrap text-[13px] leading-6 text-muted-foreground">
              {order.notes?.trim() || "Belum ada catatan."}
            </p>
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
                  <Field id="shipping-mode" label="Sumber" required error={shippingForm.errors.mode}>
                    <Select
                      value={shippingForm.data.mode}
                      onChange={(event) => shippingForm.setData("mode", event.target.value)}
                    >
                      <option value="jnt" disabled={!shippingActions.jntEnabled}>
                        Buat via J&T{shippingActions.jntEnabled ? "" : " (nonaktif)"}
                      </option>
                      <option value="manual">Input nomor resi manual</option>
                    </Select>
                  </Field>
                  {shippingForm.data.mode === "manual" ? (
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
                  ) : (
                    <Field id="weight" label="Berat (kg)" error={shippingForm.errors.weight_kg}>
                      <Input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={shippingForm.data.weight_kg}
                        onChange={(event) => shippingForm.setData("weight_kg", event.target.value)}
                      />
                    </Field>
                  )}
                  <Checkbox
                    compact
                    checked={Boolean(shippingForm.data.mark_shipped)}
                    onChange={(event) =>
                      shippingForm.setData("mark_shipped", event.target.checked)
                    }
                    label="Tandai pesanan sebagai dikirim setelah resi tersimpan"
                  />
                  <Button type="submit" className="w-full" disabled={shippingForm.processing}>
                    {shippingForm.processing
                      ? "Menyimpan..."
                      : shippingForm.data.mode === "jnt"
                        ? "Buat resi J&T"
                        : "Simpan resi"}
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
    </AdminLayout>
  )
}

