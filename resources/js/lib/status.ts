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
  draft: { label: "Draf", tone: "neutral-soft" },
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
  return_completed: { label: "Retur selesai", tone: "success-soft" },
  cancelled: { label: "Dibatalkan", tone: "danger" },
  paid: { label: "Lunas", tone: "success" },
  refunded: { label: "Dikembalikan", tone: "neutral-soft" },
  tracking_pending: { label: "Menunggu resi", tone: "neutral-soft" },
  pending: { label: "Menunggu pembayaran", tone: "warning" },
  pending_payment: { label: "Menunggu Konfirmasi", tone: "warning" },
  // Status kampanye/promo & import sekunder (nada lembut).
  scheduled: { label: "Terjadwal", tone: "info-soft" },
  // Masa berlaku sudah lewat (voucher): perlu diperpanjang atau dinonaktifkan.
  expired: { label: "Berakhir", tone: "warning-soft" },
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

/**
 * Ikon per status, dipakai StatusBadge supaya badge tidak menampilkan lingkaran
 * kosong untuk status sekunder (Draft, Terjadwal, Diakhiri, Nonaktif, dan
 * teman-temannya). Nama harus ada di registry `components/shared/icon.tsx`;
 * bila status tidak terdaftar, badge jatuh ke ikon nadanya.
 */
export const STATUS_ICONS: Record<string, string> = {
  draft: "pencil-simple",
  scheduled: "calendar",
  expired: "clock",
  ended: "archive",
  finished: "check-circle",
  archived: "archive",
  inactive: "eye-slash",
  tidak_aktif: "eye-slash",
  disabled: "eye-slash",
  unpublished: "eye-slash",
  hidden: "eye-slash",
  return_completed: "check-circle",
  refunded: "arrow-counter-clockwise",
  tracking_pending: "clock",
  queued: "clock",
  antre: "clock",
  unknown: "circle-help",
  inbound: "arrow-down-left",
}

/** Ikon spesifik status, atau null bila harus memakai ikon nada. */
export function statusIcon(status: unknown): string | null {
  return STATUS_ICONS[String(status ?? "").toLowerCase()] ?? null
}

/**
 * Status yang belum terdaftar TIDAK lagi diubah otomatis menjadi Title Case
 * Inggris. Dulu "awaiting_review" tampil "Awaiting Review", sehingga penanda
 * sistem bocor ke layar dan setiap status baru selalu lahir berbahasa Inggris.
 * Sekarang labelnya netral dan status baru wajib didaftarkan di STATUS_MAP
 * (kontrak owner 2026-10-16: penanda sistem tidak boleh tampil ke pengguna).
 */
export function statusMeta(status: unknown): StatusMeta {
  const key = String(status ?? "").toLowerCase()
  return STATUS_MAP[key] ?? {
    label: key ? "Status lain" : "Belum tersedia",
    tone: "neutral",
  }
}

/**
 * Status aset media (media_assets.status, product_media.status). Dipisahkan
 * dari STATUS_MAP karena kunci "pending" di sana berarti "Menunggu pembayaran"
 * milik pesanan, sedangkan pada media artinya "Menunggu diproses".
 */
const MEDIA_STATUS_MAP: Record<string, StatusMeta> = {
  pending: { label: "Menunggu diproses", tone: "neutral" },
  uploading: { label: "Sedang diunggah", tone: "info" },
  downloading: { label: "Mengambil media", tone: "info" },
  downloaded: { label: "Tersimpan", tone: "success" },
  processing: { label: "Sedang diproses", tone: "info" },
  ready: { label: "Siap digunakan", tone: "success" },
  failed: { label: "Gagal diproses", tone: "danger" },
  archived: { label: "Diarsipkan", tone: "neutral" },
}

export function mediaStatusMeta(status: unknown): StatusMeta {
  const key = String(status ?? "").toLowerCase()
  return MEDIA_STATUS_MAP[key] ?? {
    label: key ? "Status lain" : "Belum tersedia",
    tone: "neutral",
  }
}

/**
 * Status pekerjaan impor katalog (import_jobs.status). Dipisahkan dari
 * STATUS_MAP karena kunci "pending" di sana berarti "Menunggu pembayaran"
 * milik pesanan. Tanpa peta sendiri, daftar impor menampilkan
 * "Menunggu pembayaran" untuk berkas yang baru diunggah dan belum diproses.
 *
 * Nilai sah mengikuti enum tabel: pending, running, completed, failed.
 */
export interface ImportStatusMeta extends StatusMeta {
  icon: string
}

const IMPORT_STATUS_MAP: Record<string, ImportStatusMeta> = {
  pending: { label: "Menunggu diproses", tone: "neutral", icon: "clock" },
  running: { label: "Sedang diproses", tone: "info", icon: "spinner" },
  completed: { label: "Selesai", tone: "success", icon: "check" },
  failed: { label: "Gagal", tone: "danger", icon: "x" },
}

export function importStatusMeta(status: unknown): ImportStatusMeta {
  const key = String(status ?? "").toLowerCase()
  return IMPORT_STATUS_MAP[key] ?? {
    label: key ? "Status lain" : "Belum tersedia",
    tone: "neutral",
    icon: "clock",
  }
}

/** Jenis aset media (media_assets.kind). */
const MEDIA_KIND_LABELS: Record<string, string> = {
  image: "Gambar",
  video: "Video",
}

export function mediaKindLabel(kind: unknown): string {
  return MEDIA_KIND_LABELS[String(kind ?? "").toLowerCase()] ?? "Media"
}

/** Metode pembayaran pada catatan pembayaran (payments.payment_method). */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: "COD",
  transfer: "Transfer Bank",
  gateway: "Gateway",
  other: "Lainnya",
}

export function paymentMethodLabel(method: unknown): string {
  return PAYMENT_METHOD_LABELS[String(method ?? "").toLowerCase()] ?? "Lainnya"
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
