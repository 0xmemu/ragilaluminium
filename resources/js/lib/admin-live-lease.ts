/**
 * Aturan waktu untuk koneksi live panel admin (Tahap 3 live events, 16 Okt 2026).
 *
 * Dipisah dari modul koneksi supaya bisa diuji tanpa peramban: aturan waktu inilah
 * yang menentukan kapan sebuah tab boleh menjadi pemimpin, kapan data dianggap
 * basi, dan kapan halaman perlu dimuat ulang. Kesalahan di sini langsung terasa
 * sebagai panel yang berhenti diperbarui atau server yang dibanjiri permintaan.
 */

/**
 * Denyut keberadaan antar tab. Hanya lewat BroadcastChannel, TIDAK menyentuh
 * server. Dipisah dari denyut data supaya perpindahan pemimpin cepat tanpa
 * menambah beban server.
 */
export const LIVENESS_MS = 15_000

/**
 * Masa berlaku klaim kepemimpinan. Bila tidak ada klaim baru selama ini, tab lain
 * mengambil alih. Dibuat tiga kali denyut keberadaan supaya satu denyut yang
 * tertunda tidak langsung memicu perpindahan.
 */
export const LEASE_MS = 45_000

/**
 * Denyut data: satu-satunya permintaan berkala ke server, dan hanya dari tab
 * pemimpin. Naik dari 8 detik (perilaku lama, tiap tab) menjadi 120 detik
 * (satu tab per peramban). Inilah penurunan beban yang sesungguhnya.
 */
export const HEARTBEAT_MS = 120_000

/**
 * Ambang data basi: bila tidak ada kabar apa pun (event maupun denyut data)
 * selama ini, panel menandai dirinya mungkin tertinggal.
 */
export const STALE_MS = HEARTBEAT_MS * 2

/**
 * Batas waktu membentuk sambungan WebSocket. Bila sambungan tidak pernah
 * terbentuk dalam waktu ini (mis. otentikasi kanal gagal, atau server tidak
 * menjawab), status TIDAK boleh tertinggal di "connecting" selamanya, karena itu
 * membuat label "Menghubungkan pembaruan langsung..." tampil terus di panel admin.
 */
export const CONNECT_TIMEOUT_MS = 10_000

/** Apakah klaim kepemimpinan sudah kedaluwarsa. */
export function leaseExpired(now: number, lastClaimAt: number, leaseMs: number = LEASE_MS): boolean {
  if (lastClaimAt <= 0) return true

  return now - lastClaimAt > leaseMs
}

/**
 * Apakah penanda versi baru menuntut halaman dimuat ulang.
 *
 * Pembacaan pertama hanya dicatat, tidak memicu muat ulang: kalau tidak, setiap
 * tab akan memuat ulang begitu dibuka.
 */
export function shouldReloadOnVersion(previous: string | null, next: string | null | undefined): boolean {
  if (typeof next !== "string" || next === "") return false
  if (previous === null) return false

  return previous !== next
}

/** Apakah panel sudah terlalu lama tanpa kabar. */
export function isStale(now: number, lastMessageAt: number, staleMs: number = STALE_MS): boolean {
  if (lastMessageAt <= 0) return true

  return now - lastMessageAt > staleMs
}
