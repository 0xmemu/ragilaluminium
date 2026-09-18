/**
 * Gaya kartu toast bersama.
 *
 * Acuan tampilan: notifikasi langsung admin (live-notification-manager.tsx).
 * Ciri yang diambil:
 * - Tanpa GARIS tepi. Pemisahan dari latar ditanggung bayangan, karena kartu
 *   berbingkai terlihat tua. Karena itu pula `border-0` wajib ada: komponen
 *   Alert membawa `border` di kelas dasarnya, dan tailwind-merge membuat
 *   `border-0` menang.
 * - Sudut `rounded-xl` dan bayangan tebal supaya kartu tetap terbaca di atas
 *   konten tanpa perlu garis.
 * - `bg-surface` dipakai di terang maupun gelap; nilainya sudah putih di
 *   storefront dan gelap raised di panel admin.
 *
 * Warna teks TIDAK dimasukkan ke sini: Alert menentukan warna teks dan ikon
 * per nada (success, danger, info). Menambahkan `text-foreground` di sini akan
 * menimpanya lewat tailwind-merge dan menghapus makna warnanya.
 *
 * Aturan lengkap ada di frontend/docs/UI-CONSISTENCY-CONTRACT.md bagian Toast.
 */
export const TOAST_CARD_CLASS = "rounded-xl border-0 bg-surface shadow-2xl"
