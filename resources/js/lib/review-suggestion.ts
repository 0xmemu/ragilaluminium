/**
 * Chip saran teks pada form ulasan pelanggan: daftar teks siap pakai, deteksi
 * "sudah dipilih", dan pengalih pilih atau lepas.
 *
 * Dipisah dari komponen supaya logikanya bisa diuji langsung, karena di sini
 * pernah ada dua cacat yang tidak terlihat dari tampilan:
 *
 * 1. Penjaga "sudah dipilih" dulu membaca `message` dari closure render,
 *    sedangkan perubahan teks memakai nilai terbaru. Dua klik cepat pada chip
 *    yang sama menghasilkan teks berulang ("Pengiriman cepat, pengiriman
 *    cepat, pengiriman cepat"), karena penjaganya belum melihat chip yang baru
 *    saja ditambahkan.
 * 2. Chip kedua dan seterusnya disambung dalam huruf kecil, sementara
 *    pencocokan dulu peka huruf besar-kecil. Akibatnya chip yang sudah tampil
 *    sebagai "barang berkualitas" tidak terbaca sebagai terpilih, dan klik
 *    berikutnya menambah salinan lagi.
 *
 * Karena itu pencocokan di sini TIDAK peka huruf besar-kecil, dan pemanggil
 * wajib memberi nilai teks terbaru (nilai di dalam updater), bukan nilai dari
 * render terakhir.
 */

/** Teks siap pakai yang tampil sebagai chip di form ulasan pelanggan. */
export const SUGGESTION_CHIPS = [
  "Pengiriman cepat",
  "Barang berkualitas",
  "Pemasangan rapi",
  "Harga sesuai",
  "Pelayanan ramah",
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Pola satu chip di dalam teks.
 *
 * Hanya cocok bila chip berdiri sendiri sebagai butir yang dipisah koma, bukan
 * bagian dari kalimat. Jadi kalimat buatan pembeli seperti "pengiriman cepat
 * banget" tidak dianggap chip, karena setelah "cepat" masih ada kata lain.
 */
function chipPattern(chip: string): RegExp {
  return new RegExp(`(^|,\\s*)${escapeRegExp(chip)}(?=\\s*,|\\s*$)`, "i")
}

/** Apakah chip ini sudah ada di dalam teks. */
export function isSuggestionSelected(message: string, chip: string): boolean {
  return chipPattern(chip).test(message)
}

/**
 * Pilih chip bila belum ada, lepas bila sudah ada. Selalu mengembalikan teks
 * yang sudah dirapikan, tanpa koma sisa atau butir kosong.
 */
export function toggleSuggestion(message: string, chip: string): string {
  const trimmed = message.trim()

  if (isSuggestionSelected(trimmed, chip)) {
    return trimmed
      .replace(new RegExp(`(^|,\\s*)${escapeRegExp(chip)}(?=\\s*,|\\s*$)`, "gi"), "$1")
      .replace(/^,\s*/, "")
      .replace(/,\s*$/, "")
      .replace(/,\s*,/g, ",")
      .trim()
  }

  if (trimmed === "") return chip

  // Chip pertama apa adanya, berikutnya dihuruf-kecilkan, mengikuti bentuk
  // yang sudah dipakai sejak awal supaya data lama tetap sebanding.
  return `${trimmed.replace(/,\s*$/, "")}, ${chip.toLowerCase()}`
}
