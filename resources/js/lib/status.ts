export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger"

export interface StatusMeta {
  label: string
  tone: StatusTone
}

const STATUS_MAP: Record<string, StatusMeta> = {
  active: { label: "Aktif", tone: "success" },
  inactive: { label: "Nonaktif", tone: "neutral" },
  aktif: { label: "Aktif", tone: "success" },
  tidak_aktif: { label: "Tidak aktif", tone: "neutral" },
  baru: { label: "Baru", tone: "info" },
  archived: { label: "Diarsipkan", tone: "neutral" },
  draft: { label: "Draft", tone: "neutral" },
  awaiting_confirmation: { label: "Menunggu Konfirmasi", tone: "warning" },
  running: { label: "Sedang diproses", tone: "info" },
  completed: { label: "Selesai", tone: "success" },
  failed: { label: "Gagal", tone: "danger" },
  downloaded: { label: "Tersimpan", tone: "success" },
  downloading: { label: "Mengunduh", tone: "info" },
  visible: { label: "Tampil", tone: "success" },
  hidden: { label: "Disembunyikan", tone: "neutral" },

  processing: { label: "Diproses", tone: "info" },
  ready_to_ship: { label: "Siap Dikirim", tone: "info" },
  handover_to_carrier: { label: "Diserahkan ke Kurir", tone: "info" },
  shipped: { label: "Dikirim", tone: "success" },
  delivered: { label: "Sampai", tone: "success" },
  awaiting_pickup: { label: "Menunggu Penjemputan", tone: "info" },
  payment_pending: { label: "Menunggu Konfirmasi", tone: "warning" },
  payment_verification: { label: "Pembayaran Diverifikasi", tone: "info" },
  issue: { label: "Perlu perhatian", tone: "warning" },
  return_in_process: { label: "Retur diproses", tone: "warning" },
  return_completed: { label: "Retur selesai", tone: "neutral" },
  cancelled: { label: "Dibatalkan", tone: "danger" },
  paid: { label: "Lunas", tone: "success" },
  refunded: { label: "Dikembalikan", tone: "neutral" },
  tracking_pending: { label: "Menunggu resi", tone: "neutral" },
  pending: { label: "Menunggu pembayaran", tone: "warning" },
  pending_payment: { label: "Menunggu Konfirmasi", tone: "warning" },
  picked_up: { label: "Paket dijemput kurir", tone: "info" },
  in_transit: { label: "Dalam perjalanan", tone: "info" },
  out_for_delivery: { label: "Sedang diantar", tone: "info" },
  delivery_failed: { label: "Kendala pengiriman", tone: "danger" },
  exception: { label: "Kendala pengiriman", tone: "danger" },
  unknown: { label: "Status belum terbaca", tone: "neutral" },
  pending_pickup: { label: "Menunggu penjemputan", tone: "warning" },
  in_process: { label: "Disiapkan", tone: "info" },
  returned: { label: "Dikembalikan", tone: "warning" },
  sent: { label: "Terkirim", tone: "info" },
  read: { label: "Dibaca", tone: "success" },
  received: { label: "Diterima", tone: "success" },
  outbound: { label: "Keluar", tone: "info" },
  inbound: { label: "Masuk", tone: "neutral" },
  order_created: { label: "Pesanan Dibuat", tone: "info" },
  order_confirmed: { label: "Pesanan Dikonfirmasi", tone: "info" },
  payment_verified: { label: "Pembayaran Dikonfirmasi", tone: "success" },
}

export function statusMeta(status: unknown): StatusMeta {
  const key = String(status ?? "").toLowerCase()
  return STATUS_MAP[key] ?? {
    label: key
      ? key.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
      : "Belum tersedia",
    tone: "neutral",
  }
}

export const ORDER_STEPS = [
  "awaiting_confirmation",
  "processing",
  "shipped",
  "delivered",
  "completed",
] as const

/** Milestone pengiriman (orders.shipping_status / shipping_records.status). */
export const SHIPPING_STEPS = [
  "tracking_pending",
  "picked_up",
  "in_transit",
  "delivered",
] as const

export function orderStepIndex(status: string): number {
  if (status === "issue" || status === "return_in_process" || status === "cancelled") return -1
  return ORDER_STEPS.indexOf(status as (typeof ORDER_STEPS)[number])
}

export function shippingStepIndex(status: string): number {
  if (status === "cancelled" || status === "returned") return -1
  return SHIPPING_STEPS.indexOf(status as (typeof SHIPPING_STEPS)[number])
}
