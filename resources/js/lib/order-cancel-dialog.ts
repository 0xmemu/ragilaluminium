/**
 * Copy popup "Batalkan Pesanan" - SATU sumber untuk daftar pesanan dan halaman
 * detail pesanan.
 *
 * Sebelumnya kedua halaman menulis naskahnya sendiri sehingga isinya berbeda:
 * daftar menyebut stok dikembalikan tanpa kolom alasan, detail ringkas dan
 * punya kolom alasan. Owner meminta keduanya sama (2026-09-19), dan halaman
 * detail dijadikan acuan.
 */
export const ORDER_CANCEL_DIALOG = {
  title: "Batalkan pesanan?",
  description: "Status akan berubah menjadi dibatalkan dan tercatat di log.",
  confirmLabel: "Batalkan",
  reasonLabel: "Alasan (opsional)",
  reasonPlaceholder: "Misalnya: pelanggan meminta pembatalan",
} as const
