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
  pending: { label: "Menunggu", tone: "warning" },
  running: { label: "Sedang diproses", tone: "info" },
  completed: { label: "Selesai", tone: "success" },
  failed: { label: "Gagal", tone: "danger" },
  downloaded: { label: "Tersimpan", tone: "success" },
  downloading: { label: "Mengunduh", tone: "info" },
  visible: { label: "Tampil", tone: "success" },
  hidden: { label: "Disembunyikan", tone: "neutral" },
  pending_payment: { label: "Perlu konfirmasi", tone: "danger" },
  processing: { label: "Diproses", tone: "info" },
  shipped: { label: "Dikirim", tone: "success" },
  delivered: { label: "Sampai", tone: "success" },
  issue: { label: "Perlu perhatian", tone: "danger" },
  return_in_process: { label: "Retur diproses", tone: "warning" },
  cancelled: { label: "Dibatalkan", tone: "danger" },
  paid: { label: "Lunas", tone: "success" },
  refunded: { label: "Dikembalikan", tone: "neutral" },
  pending_pickup: { label: "Menunggu penjemputan", tone: "warning" },
  in_process: { label: "Disiapkan", tone: "info" },
  in_transit: { label: "Dalam perjalanan", tone: "info" },
  returned: { label: "Dikembalikan", tone: "warning" },
  sent: { label: "Terkirim", tone: "info" },
  read: { label: "Dibaca", tone: "success" },
  received: { label: "Diterima", tone: "success" },
  outbound: { label: "Keluar", tone: "info" },
  inbound: { label: "Masuk", tone: "neutral" },
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
  "pending_payment",
  "processing",
  "shipped",
  "delivered",
  "completed",
] as const

export function orderStepIndex(status: string): number {
  if (status === "issue" || status === "return_in_process" || status === "cancelled") return -1
  return ORDER_STEPS.indexOf(status as (typeof ORDER_STEPS)[number])
}
