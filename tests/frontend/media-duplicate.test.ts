import { describe, expect, it } from "vitest"

import {
  fileChecksum,
  isValidChecksum,
  partitionWithinBatch,
} from "@/lib/media-duplicate"

/**
 * Penjaga berkas kembar di Media Library (kontrak owner 2026-10-14, menggantikan
 * kontrak 2026-10-08).
 *
 * Aturannya sekarang: kembar hanya ditolak bila keduanya masuk pada AKSI UNGGAH
 * YANG SAMA. Berkas yang isinya sama dengan aset dari aksi sebelumnya dibiarkan,
 * karena admin toko memang sering sengaja memakai satu foto untuk dua produk yang
 * dimensinya berdekatan. Aturan lama menahan berkas yang sudah ada di Media
 * Library, sehingga folder produk kedua jadi kosong.
 *
 * Yang dijaga di sini: kemunculan pertama sebuah sidik jari tetap dikirim,
 * kemunculan berikutnya dalam aksi yang sama ditolak, dan sidik jari yang gagal
 * dihitung tidak pernah ditahan.
 */

const SIDIK_HELLO = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
const SIDIK_WORLD = "486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7"

function entri(id: number, checksum: string | null, name = `berkas-${id}.png`) {
  return { id, name, checksum }
}

describe("isValidChecksum", () => {
  it("menerima sidik jari SHA-256 heksadesimal huruf kecil", () => {
    expect(isValidChecksum(SIDIK_HELLO)).toBe(true)
  })

  it("menolak panjang yang tidak tepat", () => {
    expect(isValidChecksum(SIDIK_HELLO.slice(0, 63))).toBe(false)
    expect(isValidChecksum(SIDIK_HELLO + "a")).toBe(false)
  })

  it("menolak huruf besar dan karakter di luar heksadesimal", () => {
    expect(isValidChecksum(SIDIK_HELLO.toUpperCase())).toBe(false)
    expect(isValidChecksum("z".repeat(64))).toBe(false)
  })

  it("menolak nilai yang bukan teks", () => {
    expect(isValidChecksum(null)).toBe(false)
    expect(isValidChecksum(undefined)).toBe(false)
    expect(isValidChecksum(1234)).toBe(false)
  })
})

describe("fileChecksum", () => {
  it("menghitung SHA-256 dari isi berkas", async () => {
    const berkas = new File(["hello"], "a.png", { type: "image/png" })

    expect(await fileChecksum(berkas)).toBe(SIDIK_HELLO)
  })

  it("isi yang sama menghasilkan sidik jari yang sama walau nama berkas berbeda", async () => {
    const satu = new File(["hello"], "jungkit.PNG", { type: "image/png" })
    const dua = new File(["hello"], "salinan-jungkit.PNG", { type: "image/png" })

    expect(await fileChecksum(satu)).toBe(await fileChecksum(dua))
  })

  it("isi yang berbeda menghasilkan sidik jari yang berbeda", async () => {
    const satu = new File(["hello"], "a.png")
    const dua = new File(["world"], "b.png")

    expect(await fileChecksum(satu)).not.toBe(await fileChecksum(dua))
  })
})

describe("partitionWithinBatch", () => {
  it("mengirim kemunculan pertama dan menolak kembarannya dalam aksi yang sama", () => {
    // Kasus yang dimaksud owner: satu aksi unggah memuat berkas yang sama dua
    // kali, dan itu hampir pasti kecelakaan.
    const hasil = partitionWithinBatch([
      entri(1, SIDIK_HELLO, "jungkit.PNG"),
      entri(2, SIDIK_HELLO, "jungkit.PNG"),
    ])

    expect(hasil.rest.map((e) => e.id)).toEqual([1])
    expect(hasil.dup.map((e) => e.id)).toEqual([2])
  })

  it("mengirim semua berkas yang isinya berbeda", () => {
    const hasil = partitionWithinBatch([entri(1, SIDIK_HELLO), entri(2, SIDIK_WORLD)])

    expect(hasil.rest.map((e) => e.id)).toEqual([1, 2])
    expect(hasil.dup).toEqual([])
  })

  it("tidak menahan berkas yang isinya sama dengan aset dari aksi sebelumnya", () => {
    // Inti perubahan kontrak: satu aksi unggah yang hanya memuat satu berkas
    // TIDAK PERNAH menolak apa pun, walau isinya sudah ada di Media Library.
    // Pemeriksaannya hanya di dalam aksi ini, jadi tidak ada daftar pustaka yang
    // perlu ditanyakan ke server.
    const hasil = partitionWithinBatch([entri(1, SIDIK_HELLO)])

    expect(hasil.rest.map((e) => e.id)).toEqual([1])
    expect(hasil.dup).toEqual([])
  })

  it("sidik jari yang gagal dihitung tidak pernah tertahan", () => {
    // Isinya tidak bisa dibandingkan, jadi berkasnya tetap dikirim. Menahannya
    // akan membuat berkas yang sah hilang hanya karena perhitungan gagal.
    const hasil = partitionWithinBatch([entri(1, null), entri(2, null)])

    expect(hasil.rest.map((e) => e.id)).toEqual([1, 2])
    expect(hasil.dup).toEqual([])
  })

  it("tiga berkas identik menyisakan tepat satu yang dikirim", () => {
    const hasil = partitionWithinBatch([
      entri(1, SIDIK_HELLO),
      entri(2, SIDIK_HELLO),
      entri(3, SIDIK_HELLO),
    ])

    expect(hasil.rest.map((e) => e.id)).toEqual([1])
    expect(hasil.dup.map((e) => e.id)).toEqual([2, 3])
  })

  it("memisahkan campuran berkas baru dan berkas kembar", () => {
    const hasil = partitionWithinBatch([
      entri(1, SIDIK_HELLO),
      entri(2, SIDIK_WORLD),
      entri(3, SIDIK_HELLO),
      entri(4, null),
      entri(5, SIDIK_WORLD),
    ])

    expect(hasil.rest.map((e) => e.id)).toEqual([1, 2, 4])
    expect(hasil.dup.map((e) => e.id)).toEqual([3, 5])
  })
})
