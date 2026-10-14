/**
 * Penyaring berkas sebelum masuk Media Library.
 *
 * Latar: pemilih folder peramban (`webkitdirectory`) MENGABAIKAN atribut
 * `accept`, jadi seluruh berkas di dalam folder ikut terpilih, termasuk berkas
 * sistem yang dibuat sistem operasi sendiri: `Thumbs.db` (cache gambar mini
 * Windows), `desktop.ini` (setelan folder Windows), serta `.DS_Store` dan `._*`
 * (macOS). Berkas itu tidak pernah layak masuk Media Library. Bila ikut
 * terkirim, server menolaknya dengan galat "tipe file tidak diizinkan" sehingga
 * admin melihat kegagalan yang membingungkan tanpa tahu berkas mana penyebabnya.
 *
 * Penyaringan memakai NAMA untuk berkas sistem dan JENIS untuk berkas lain.
 * Jenis yang kosong (peramban tidak mengenali ekstensinya) diperiksa ulang lewat
 * ekstensi supaya berkas media yang sah tidak ikut terbuang.
 */

/** Nama berkas sistem yang selalu dibuang (dibandingkan dalam huruf kecil). */
const NAMA_SISTEM = new Set([
  "thumbs.db",
  "ehthumbs.db",
  "ehthumbs_vista.db",
  "desktop.ini",
  ".ds_store",
  ".localized",
])

/**
 * Awalan nama berkas sistem macOS. Resource fork (`._foto.jpg`) menyerupai
 * berkas media padahal isinya metadata, jadi diperiksa sebelum ekstensi.
 */
const AWALAN_SISTEM = ["._"]

/**
 * Ekstensi media yang didukung server (lihat `config/media.php`). Dipakai
 * sebagai cadangan saat peramban tidak melaporkan jenis berkas.
 */
const EKSTENSI_MEDIA = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "mp4",
  "webm",
  "mov",
])

/** Bentuk minimal berkas yang dibutuhkan penyaring. */
export type BerkasMirip = { name: string; type: string }

/** Apakah nama ini berkas sistem yang harus dibuang. */
export function berkasSistem(nama: string): boolean {
  const bersih = nama.trim().toLowerCase()
  if (bersih === "") return true
  if (NAMA_SISTEM.has(bersih)) return true

  return AWALAN_SISTEM.some((awalan) => bersih.startsWith(awalan))
}

/** Ekstensi huruf kecil tanpa titik, atau string kosong bila tidak ada. */
export function ekstensiBerkas(nama: string): string {
  const titik = nama.lastIndexOf(".")
  if (titik < 0 || titik === nama.length - 1) return ""

  return nama.slice(titik + 1).trim().toLowerCase()
}

/** Apakah berkas ini media yang bisa diterima server. */
export function berkasMediaDiterima(berkas: BerkasMirip): boolean {
  const jenis = (berkas.type || "").trim().toLowerCase()
  if (jenis.startsWith("image/") || jenis.startsWith("video/")) return true
  // Jenis yang dilaporkan tapi bukan gambar/video (mis. application/pdf) sudah
  // cukup untuk menolak, tidak perlu memeriksa ekstensi.
  if (jenis !== "") return false

  return EKSTENSI_MEDIA.has(ekstensiBerkas(berkas.name))
}

export type HasilSaring<T extends BerkasMirip> = {
  /** Berkas yang lolos dan siap diunggah. */
  diterima: T[]
  /** Berkas yang dibuang, supaya admin bisa diberi tahu. */
  dilewati: T[]
}

/** Pisahkan berkas yang layak diunggah dari berkas sistem dan bukan media. */
export function saringBerkasMedia<T extends BerkasMirip>(daftar: readonly T[]): HasilSaring<T> {
  const diterima: T[] = []
  const dilewati: T[] = []

  for (const berkas of daftar) {
    if (berkasSistem(berkas.name) || !berkasMediaDiterima(berkas)) {
      dilewati.push(berkas)
    } else {
      diterima.push(berkas)
    }
  }

  return { diterima, dilewati }
}
