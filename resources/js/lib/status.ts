export type StatusTone =
  | "neutral"
  | "info"
  | "warning"
  | "success"
  | "danger"
  // Nada lembut untuk label status sekunder (bukan status event utama pesanan).
  | "info-soft"
  | "success-soft"
  | "warning-soft"
  | "neutral-soft"

export interface StatusMeta {
  label: string
  tone: StatusTone
}

const STATUS_MAP: Record<string, StatusMeta> = {
  active: { label: "Aktif", tone: "success" },
  inactive: { label: "Nonaktif", tone: "neutral-soft" },
  aktif: { label: "Aktif", tone: "success" },
  tidak_aktif: { label: "Tidak aktif", tone: "neutral-soft" },
  baru: { label: "Baru", tone: "info-soft" },
  archived: { label: "Diarsipkan", tone: "neutral-soft" },
  draft: { label: "Draft", tone: "neutral-soft" },
  awaiting_confirmation: { label: "Menunggu Konfirmasi", tone: "warning" },
  confirmed: { label: "Menunggu Konfirmasi", tone: "warning" },
  running: { label: "Sedang diproses", tone: "info-soft" },
  completed: { label: "Selesai", tone: "success" },
  failed: { label: "Gagal", tone: "danger" },
  downloaded: { label: "Tersimpan", tone: "success" },
  downloading: { label: "Mengunduh", tone: "info-soft" },
  visible: { label: "Tampil", tone: "success" },
  hidden: { label: "Disembunyikan", tone: "neutral-soft" },

  processing: { label: "Diproses", tone: "info" },
  ready_to_ship: { label: "Siap Dikirim", tone: "info" },
  handover_to_carrier: { label: "Diserahkan ke Kurir", tone: "info" },
  shipped: { label: "Dikirim", tone: "success" },
  delivered: { label: "Sampai", tone: "success" },
  awaiting_pickup: { label: "Menunggu Penjemputan", tone: "info" },
  payment_pending: { label: "Menunggu Konfirmasi", tone: "warning" },
  payment_verification: { label: "Pembayaran Diverifikasi", tone: "info" },
  issue: { label: "Perlu perhatian", tone: "warning" },
  return_in_process: { label: "Retur diproses", tone: "warning-soft" },
  return_completed: { label: "Retur selesai", tone: "neutral-soft" },
  cancelled: { label: "Dibatalkan", tone: "danger" },
  paid: { label: "Lunas", tone: "success" },
  refunded: { label: "Dikembalikan", tone: "neutral-soft" },
  tracking_pending: { label: "Menunggu resi", tone: "neutral-soft" },
  pending: { label: "Menunggu pembayaran", tone: "warning" },
  pending_payment: { label: "Menunggu Konfirmasi", tone: "warning" },
  // Status kampanye/promo & import sekunder (nada lembut).
  scheduled: { label: "Terjadwal", tone: "info-soft" },
  ended: { label: "Diakhiri", tone: "neutral-soft" },
  finished: { label: "Selesai", tone: "success-soft" },
  picked_up: { label: "Paket dijemput kurir", tone: "info" },
  in_transit: { label: "Dalam perjalanan", tone: "info" },
  out_for_delivery: { label: "Sedang diantar", tone: "info" },
  delivery_failed: { label: "Kendala pengiriman", tone: "danger" },
  exception: { label: "Kendala pengiriman", tone: "danger" },
  unknown: { label: "Status belum terbaca", tone: "neutral-soft" },
  pending_pickup: { label: "Menunggu penjemputan", tone: "warning" },
  in_process: { label: "Disiapkan", tone: "info" },
  returned: { label: "Dikembalikan", tone: "warning-soft" },
  sent: { label: "Terkirim", tone: "info-soft" },
  read: { label: "Dibaca", tone: "success" },
  received: { label: "Diterima", tone: "success" },
  outbound: { label: "Keluar", tone: "info" },
  inbound: { label: "Masuk", tone: "neutral-soft" },
  // Hasil operasi sistem (log aktivitas, riwayat media, antrean proses).
  success: { label: "Sukses", tone: "success" },
  sukses: { label: "Sukses", tone: "success" },
  berhasil: { label: "Berhasil", tone: "success" },
  error: { label: "Gagal", tone: "danger" },
  gagal: { label: "Gagal", tone: "danger" },
  queued: { label: "Antre", tone: "neutral-soft" },
  antre: { label: "Antre", tone: "neutral-soft" },
  ready: { label: "Siap", tone: "success" },
  siap: { label: "Siap", tone: "success" },
  dedup: { label: "Duplikat", tone: "warning" },
  published: { label: "Terbit", tone: "success" },
  unpublished: { label: "Tidak Terbit", tone: "neutral-soft" },
  enabled: { label: "Aktif", tone: "success" },
  disabled: { label: "Nonaktif", tone: "neutral-soft" },
  connected: { label: "Terhubung", tone: "success" },
  disconnected: { label: "Terputus", tone: "danger" },
  // Nada kesehatan gateway pada halaman Sambungkan Nomor WhatsApp.
  sehat: { label: "Sehat", tone: "success" },
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
