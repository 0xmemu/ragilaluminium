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
  // Boolean juga tidak pernah masuk daftar kolom wajib karena `required` di
  // Laravel meloloskan false; yang diwajibkan hanya kolom teks, pilihan, dan
  // daftar.
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

export interface GerbangOpsi {
  /** Daftar nama kolom, atau peta nama ke label yang dibaca manusia. */
  fields: string[] | Record<string, string>
  /** Kalimat dasar; rincian kolom kosong ditambahkan di belakangnya. */
  reason?: string
  /** Form edit: terkunci selama belum ada perubahan sama sekali. */
  requireChange?: boolean
}

const ALASAN_BAWAAN = "Lengkapi kolom wajib sebelum menyimpan."
const ALASAN_TANPA_PERUBAHAN = "Belum ada perubahan yang perlu disimpan."

/** Hitung keadaan gerbang. Murni: hanya membaca data, tidak menyimpan apa pun. */
export function hitungGerbang({
  form,
  fields,
  reason = ALASAN_BAWAAN,
  requireChange = false,
}: GerbangOpsi & { form: GerbangForm }): GerbangHasil {
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
 * Bungkus handler submit halaman dengan keadaan gerbang.
 *
 * Tombol mati saja tidak cukup: menekan Enter di dalam isian tetap mengirim form
 * walau tombolnya mati. Karena penjaga ini dan keadaan tombol dihitung dari
 * fungsi yang sama, keduanya tidak bisa berbeda pendapat.
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
 * Penjaga untuk handler onSubmit yang ditulis panjang di JSX: panggil sebagai
 * baris pertama, dan bila gerbangnya terkunci kiriman dibatalkan.
 *
 * ```tsx
 * onSubmit={(event) => {
 *   if (!gerbangBolehLanjut(event, form, gerbang)) return
 *   ...
 * }}
 * ```
 *
 * Dipakai halaman yang handler-nya tidak bisa dengan mudah dibungkus dari luar.
 */
export function gerbangBolehLanjut(
  event: { preventDefault: () => void },
  form: GerbangForm,
  opsi: GerbangOpsi,
): boolean {
  if (hitungGerbang({ form, ...opsi }).terkunci) {
    event.preventDefault()
    return false
  }
  return true
}

/**
 * Bentuk yang dipakai halaman: gerbangnya dipegang satu objek opsi, lalu objek
 * yang sama dipakai tombol dan penjaga onSubmit, sehingga keduanya tidak bisa
 * berbeda pendapat.
 *
 * ```tsx
 * const gerbang = { fields: { name: "Nama Kategori" }, requireChange: isEdit }
 *
 * <form onSubmit={jagaGerbang(gerbang, form, submit)}>
 *   <SubmitGateButton form={form} {...gerbang} formId="category-form" processing={form.processing}>
 *     Tambah
 *   </SubmitGateButton>
 * ```
 */
export function jagaGerbang(
  opsi: GerbangOpsi,
  form: GerbangForm,
  handler: (event: FormEvent) => void,
): (event: FormEvent) => void {
  const { terkunci } = hitungGerbang({ form, ...opsi })

  return jagaKiriman<FormEvent>(terkunci, handler)
}

/**
 * Bentuk siap pakai untuk atribut `onSubmit` milik form:
 *
 * ```tsx
 * <form onSubmit={jagaSubmit(form, fields, submit)}>
 * ```
 *
 * Panggil langsung di JSX, jangan disimpan di variabel di luar komponen, supaya
 * keadaannya ikut render terakhir.
 */
export function jagaSubmit(
  form: GerbangForm,
  fields: string[] | Record<string, string>,
  handler: (event: FormEvent) => void,
  options: { reason?: string; requireChange?: boolean } = {},
): (event: FormEvent) => void {
  const { terkunci } = hitungGerbang({ form, fields, ...options })

  return jagaKiriman<FormEvent>(terkunci, handler)
}
