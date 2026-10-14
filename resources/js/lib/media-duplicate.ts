/**
 * Pemeriksaan berkas kembar DI DALAM satu aksi unggah.
 *
 * Kontrak owner 2026-10-14, menggantikan kontrak 2026-10-08:
 *
 * - Berkas yang isinya identik hanya ditolak bila keduanya masuk pada AKSI
 *   UNGGAH YANG SAMA. Di situ duplikat hampir pasti kecelakaan, yaitu berkas
 *   yang sama terpilih dua kali.
 * - Berkas yang isinya sama dengan aset dari aksi unggah SEBELUMNYA dibiarkan.
 *   Admin toko memang sering sengaja memakai satu foto untuk dua produk yang
 *   dimensinya berdekatan (mis. produk 120 cm dan produk 110 cm). Kalau
 *   ditolak, folder produk kedua jadi kosong dan admin dipaksa memakai media
 *   milik folder produk pertama.
 *
 * Karena itu pemeriksaan tidak lagi menanyakan pustaka ke server, dan dialog
 * "Lewati atau Tetap unggah" dihapus. Satu aksi unggah = satu kali admin
 * memilih berkas di dialog unggah, yang seluruh berkasnya dikirim dalam satu
 * gelombang dari komponen ini.
 *
 * Sidik jari dihitung di browser memakai SHA-256 atas isi berkas. Algoritme dan
 * sumbernya sama dengan yang dipakai server (hash_file sha256), jadi berkas yang
 * sama menghasilkan nilai yang sama di kedua sisi.
 */

export type DuplicateEntry = { id: number; name: string; checksum: string | null }

/** Sidik jari SHA-256 dalam heksadesimal huruf kecil. */
const POLA_SIDIK_JARI = /^[a-f0-9]{64}$/

export function isValidChecksum(value: unknown): value is string {
  return typeof value === "string" && POLA_SIDIK_JARI.test(value)
}

/**
 * Sidik jari isi satu berkas. Mengembalikan null bila tidak bisa dihitung.
 *
 * Pemanggil memperlakukan null sebagai "tidak diperiksa": berkasnya tetap
 * dikirim, karena pemeriksaan yang tidak bisa dijalankan tidak boleh
 * menghambat unggahan.
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

export type DuplicatePartition<T extends DuplicateEntry> = {
  /** Berkas kembar di dalam aksi ini; hanya kemunculan pertama yang dikirim. */
  dup: T[]
  /** Berkas yang dikirim. */
  rest: T[]
}

/**
 * Pisahkan berkas kembar DI DALAM satu aksi unggah.
 *
 * Kemunculan PERTAMA sebuah sidik jari dikirim, kemunculan berikutnya dengan
 * sidik jari yang sama ditolak. Sidik jari yang gagal dihitung (null) selalu
 * dikirim, karena isinya tidak bisa dibandingkan.
 *
 * Fungsi ini sengaja tidak menerima daftar duplikat dari server: yang diperiksa
 * hanya berkas di dalam aksi ini, bukan isi Media Library.
 */
export function partitionWithinBatch<T extends DuplicateEntry>(
  entries: T[],
): DuplicatePartition<T> {
  const dilihat = new Set<string>()
  const dup: T[] = []
  const rest: T[] = []

  for (const entry of entries) {
    if (!isValidChecksum(entry.checksum)) {
      rest.push(entry)
      continue
    }

    if (dilihat.has(entry.checksum)) {
      dup.push(entry)
      continue
    }

    dilihat.add(entry.checksum)
    rest.push(entry)
  }

  return { dup, rest }
}
