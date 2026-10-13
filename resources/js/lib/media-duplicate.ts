/**
 * Pemeriksaan duplikat berkas SEBELUM diunggah.
 *
 * Kontrak owner 2026-10-08: berkas yang isinya identik dengan aset yang sudah ada
 * di Media Library tidak dikirim sama sekali, dan admin diberi peringatan lebih
 * dulu. Pemeriksaan di sisi server tidak bisa menggantikan ini, karena pada saat
 * server sudah bisa memeriksa berkasnya, berkas itu telanjur terkirim.
 *
 * Sidik jari dihitung di browser memakai SHA-256 atas isi berkas. Algoritme dan
 * sumbernya sama dengan yang dipakai server (hash_file sha256), jadi berkas yang
 * sama menghasilkan nilai yang sama di kedua sisi.
 */

export type MediaDuplicate = {
  id: number
  label: string
  kind: "image" | "video"
  status: string
  usage_count: number
  thumb_url: string | null
}

/** Sidik jari SHA-256 dalam heksadesimal huruf kecil. */
const POLA_SIDIK_JARI = /^[a-f0-9]{64}$/

/** Batas jumlah sidik jari per permintaan, selaras validasi di server. */
export const MAX_CHECKSUMS_PER_REQUEST = 50

export function isValidChecksum(value: unknown): value is string {
  return typeof value === "string" && POLA_SIDIK_JARI.test(value)
}

/**
 * Sidik jari isi satu berkas. Mengembalikan null bila tidak bisa dihitung.
 *
 * Pemanggil memperlakukan null sebagai "tidak diperiksa", bukan "tidak duplikat":
 * pemeriksaan yang tidak bisa dijalankan tidak boleh menghambat unggahan, dan
 * penggabungan di server tetap menjadi penjaga terakhirnya.
 */
export async function fileChecksum(file: File): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null

  try {
    const isi = await file.arrayBuffer()
    const sidik = await crypto.subtle.digest("SHA-256", isi)

    return Array.from(new Uint8Array(sidik))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  } catch {
    return null
  }
}

export type DuplicateEntry = { id: number; name: string; checksum: string | null }

export type DuplicatePartition<T extends DuplicateEntry> = {
  /** Berkas yang isinya sudah ada di Media Library. */
  dup: T[]
  /** Berkas yang aman dikirim. */
  rest: T[]
}

/**
 * Pisahkan berkas yang sudah ada dari yang belum.
 *
 * Sidik jari yang gagal dihitung (null) selalu masuk kelompok "rest", dan sidik
 * jari yang tidak muncul di hasil pemeriksaan juga dianggap belum ada.
 */
export function partitionByDuplicate<T extends DuplicateEntry>(
  entries: T[],
  duplicates: Record<string, MediaDuplicate>,
): DuplicatePartition<T> {
  const dup: T[] = []
  const rest: T[] = []

  for (const entry of entries) {
    if (entry.checksum && duplicates[entry.checksum]) dup.push(entry)
    else rest.push(entry)
  }

  return { dup, rest }
}

/** Sidik jari unik yang layak dikirim ke server. */
export function collectChecksums(entries: DuplicateEntry[]): string[] {
  const unik = new Set<string>()

  for (const entry of entries) {
    if (isValidChecksum(entry.checksum)) unik.add(entry.checksum)
  }

  return Array.from(unik)
}

/** Kalimat judul dialog peringatan. */
export function duplicateHeadline(jumlah: number): string {
  if (jumlah <= 1) return "Berkas ini sudah ada di Media Library"
  return `${jumlah} berkas sudah ada di Media Library`
}

/** Kalimat penjelas di bawah judul dialog peringatan. */
export function duplicateExplanation(jumlah: number): string {
  const dasar =
    "Isinya sama persis dengan aset yang sudah tersimpan, jadi mengunggahnya lagi tidak menambah apa pun."

  if (jumlah <= 1) return `${dasar} Pakai aset yang ada, atau tetap unggah bila memang disengaja.`

  return `${dasar} Lewati yang sudah ada, atau tetap unggah semuanya bila memang disengaja.`
}
