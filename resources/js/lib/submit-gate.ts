import type { FormEvent } from "react"

/**
 * Gerbang isi tombol simpan (kontrak owner "logika tombol", 12 Oktober 2026).
 *
 * Tombol yang aksinya PASTI ditolak server tidak boleh dibiarkan aktif. Gerbang
 * ini memeriksa dua hal yang sudah diketahui di muka, tanpa menebak aturan
 * server:
 *
 *   1. kolom wajib masih kosong. Daftar kolomnya diberikan halaman dan diambil
 *      dari aturan `required` di controller, jadi frontend TIDAK menciptakan
 *      aturan baru yang bisa berbeda dari backend;
 *   2. di form edit, belum ada perubahan sama sekali (`form.isDirty`).
 *
 * Yang sengaja TIDAK dilakukan: apa pun terhadap `form.errors`. Gerbang hanya
 * mengunci tombol, tidak pernah menghapus atau menimpa pesan error server,
 * sehingga penolakan yang bukan soal kolom kosong (mis. nama sudah dipakai)
 * tetap tampil apa adanya dan bisa diperbaiki admin.
 *
 * Logikanya ditulis sebagai fungsi murni supaya bisa diuji perilakunya
 * (masukan ke keputusan), bukan sekadar dihitung berapa kali dipakai.
 */

/** Nilai dianggap kosong mengikuti arti "required" di server. */
export function kosong(nilai: unknown): boolean {
  if (nilai === null || nilai === undefined) return true
  if (typeof nilai === "string") return nilai.trim() === ""
  if (Array.isArray(nilai)) return nilai.length === 0
  // Angka 0 dan `false` BUKAN kosong: server menerima keduanya sebagai nilai.
  return false
}

/** Ambil nilai bersarang lewat jalur bertitik, mis. "steps.0.title". */
export function nilaiJalur(data: unknown, jalur: string): unknown {
  return jalur.split(".").reduce<unknown>((kini, bagian) => {
    if (kini === null || kini === undefined) return undefined
    if (Array.isArray(kini)) return kini[Number(bagian)]
    if (typeof kini === "object") return (kini as Record<string, unknown>)[bagian]
    return undefined
  }, data)
}

/** Bagian form yang dibutuhkan gerbang. `useForm` dari Inertia sudah memenuhi ini. */
export interface GerbangForm {
  processing: boolean
  isDirty: boolean
  /** Terbuka untuk tipe apa saja supaya `useForm` yang bertipe bisa langsung dipakai. */
  data: unknown
}

export interface GerbangHasil {
  /** Tombol harus mati. */
  terkunci: boolean
  /** Alasan yang ditampilkan di dekat tombol. Selalu ada saat terkunci. */
  alasan?: string
  /** Jalur kolom wajib yang masih kosong, untuk menyorot isiannya. */
  kolomKosong: string[]
}

const ALASAN_BAWAAN = "Lengkapi kolom wajib sebelum menyimpan."
const ALASAN_TANPA_PERUBAHAN = "Belum ada perubahan yang perlu disimpan."

/**
 * Hitung keadaan gerbang. Murni: hanya membaca data, tidak menyimpan apa pun.
 */
export function hitungGerbang({
  form,
  fields,
  reason = ALASAN_BAWAAN,
  requireChange = false,
}: {
  form: GerbangForm
  /** Daftar nama kolom, atau peta nama ke label yang dibaca manusia. */
  fields: string[] | Record<string, string>
  /** Kalimat dasar; rincian kolom kosong ditambahkan di belakangnya. */
  reason?: string
  /** Form edit: terkunci selama belum ada perubahan sama sekali. */
  requireChange?: boolean
}): GerbangHasil {
  const peta: Record<string, string> = Array.isArray(fields)
    ? Object.fromEntries(fields.map((jalur) => [jalur, jalur]))
    : fields

  const kolomKosong = Object.keys(peta).filter((jalur) => kosong(nilaiJalur(form.data, jalur)))
  const belumBerubah = requireChange && !form.isDirty

  if (kolomKosong.length > 0) {
    const daftar = kolomKosong.map((jalur) => `"${peta[jalur]}"`).join(", ")
    return { terkunci: true, alasan: `${reason} Kolom ${daftar} masih kosong.`, kolomKosong }
  }

  if (belumBerubah) {
    return { terkunci: true, alasan: ALASAN_TANPA_PERUBAHAN, kolomKosong }
  }

  return { terkunci: false, kolomKosong }
}

/**
 * Bungkus handler submit halaman.
 *
 * Tombol mati saja tidak cukup: menekan Enter di dalam isian tetap mengirim form
 * walau tombolnya mati. Kalau penjaga di sini dan keadaan tombol dihitung dari
 * sumber yang sama, keduanya tidak bisa berbeda pendapat.
 */
export function jagaKiriman<E extends { preventDefault: () => void }>(
  terkunci: boolean,
  handler: (event: E) => void,
): (event: E) => void {
  return (event) => {
    if (terkunci) {
      event.preventDefault()
      return
    }
    handler(event)
  }
}

/**
 * Gerbang siap pakai: keadaan tombol plus penjaga kiriman, dihitung dari sumber
 * yang sama supaya keduanya tidak bisa berbeda pendapat.
 *
 * Sengaja BUKAN hook. Gerbang ini tidak menyimpan state apa pun, ia hanya
 * membaca `form.data` dan `form.isDirty` pada render yang sedang berjalan, jadi
 * bentuk hook hanya menambah upacara tanpa menambah kemampuan. Nama `buat`
 * dipakai supaya tidak berpura-pura jadi hook.
 */
export function buatGerbang(options: {
  form: GerbangForm
  fields: string[] | Record<string, string>
  reason?: string
  requireChange?: boolean
}): GerbangHasil & {
  guard: (handler: (event: FormEvent) => void) => (event: FormEvent) => void
} {
  const { form, fields, reason, requireChange } = options
  const hasil = hitungGerbang({ form, fields, reason, requireChange })

  return {
    ...hasil,
    guard: (handler) => jagaKiriman<FormEvent>(hasil.terkunci, handler),
  }
}
